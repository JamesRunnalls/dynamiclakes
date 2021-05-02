import * as THREE from "three";

class StreamLines {
  constructor(data, bounds, scene, options = {}) {
    this.data = this.verfiyData(data);
    this.bounds = this.computeBounds(data, bounds);
    this.scene = scene;
    this.noParticles = options.noParticles || 5000;
    this.maxAge = options.maxAge || 200;
    this.fadeOutPercentage = options.fadeOutPercentage || 0.1;
    this.velocityFactor = options.velocityFactor || 2;
    this.colors = options.colors || [
      { color: "#000000", point: 0.0 },
      { color: "#ff0000", point: 1.0 },
    ];
    this.fadeOut = Math.round(this.maxAge * this.fadeOutPercentage);

    this.minMax = options.minMax || this.getMinMax();

    this.updateColors(this.colors);
    this.getValidCells();
    this.add();
  }

  verfiyData = (data) => {
    return data;
  };

  computeBounds = (data, bounds) => {
    bounds["yLen"] = data.length;
    bounds["xLen"] = data[0].length;
    bounds["zLen"] = data[0][0].length;
    bounds["ySize"] = (bounds["yMax"] - bounds["yMin"]) / bounds["yLen"];
    bounds["xSize"] = (bounds["xMax"] - bounds["xMin"]) / bounds["xLen"];
    bounds["zSize"] = (bounds["zMax"] - bounds["zMin"]) / bounds["zLen"];
    return bounds;
  };

  getMinMax = () => {
    var max = -Infinity;
    var min = Infinity;
    for (let i = 0; i < this.bounds["yLen"]; i++) {
      for (let j = 0; j < this.bounds["xLen"]; j++) {
        max = Math.max(max, Math.max(...this.data[i][j].flat(Infinity)));
        min = Math.min(min, Math.min(...this.data[i][j].flat(Infinity)));
      }
    }
    return [min, max];
  };

  getValidCells = () => {
    this.validCells = [];
    for (let i = 0; i < this.bounds["yLen"]; i++) {
      for (let j = 0; j < this.bounds["xLen"]; j++) {
        for (let k = 0; k < this.bounds["zLen"]; k++) {
          if (
            this.data[i][j][k][0] !== null &&
            this.data[i][j][k][1] !== null &&
            this.data[i][j][k][2] !== null
          ) {
            this.validCells.push([i, j, k]);
          }
        }
      }
    }
  };

  add = () => {
    var vertexShader = `
      precision mediump float;
      precision mediump int;

      attribute vec4 color;
      varying vec4 vColor;

      void main()    {

        vColor = color;

        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

      }
    `;
    var fragmentShader = `
      precision mediump float;
      precision mediump int;

      varying vec4 vColor;

      void main()    {

        vec4 color = vec4( vColor );
        gl_FragColor = color;

      }
    `;

    var geometry = new THREE.BufferGeometry();

    var colors = new Array(this.maxAge * 4).fill(1);
    geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 4, true)
    );

    var positions = new Float32Array(this.maxAge * 3);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setDrawRange(0, 0);

    var material = new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
    });

    this.streamlines = new THREE.Group();
    for (var p = 0; p < this.noParticles; p++) {
      let line = new THREE.Line(geometry.clone(), material.clone());
      line.age = 0;
      line.maxAge =
        Math.round((this.maxAge - this.fadeOut) * Math.random()) + this.fadeOut;
      this.streamlines.add(line);
    }
    this.scene.add(this.streamlines);
  };

  initialPositions = () => {
    var pl = this.randomPick.length - 1;
    for (var i = 0; i < this.streamlines.children.length; i++) {
      let line = this.streamlines.children[i];
      let pick = this.randomPick[Math.round(pl * Math.random())];
      let positions = line.geometry.attributes.position.array;
      positions[0] = this.bounds.xMin + this.bounds.xSize * pick[1]; // x
      positions[1] = this.bounds.zMin + this.bounds.zSize * pick[2]; // z
      positions[2] = -this.bounds.yMin + this.bounds.ySize * pick[0]; // -y
      positions[3] = positions[0];
      positions[4] = positions[1];
      positions[5] = positions[2];
      line.geometry.attributes.position.needsUpdate = true;
    }
  };

  animate = () => {
    var pl = this.randomPick.length - 1;
    for (var i = 0; i < this.streamlines.children.length; i++) {
      let line = this.streamlines.children[i];
      let positions = line.geometry.attributes.position.array;
      let colors = line.geometry.attributes.color.array;
      if (line.age < line.maxAge - this.fadeOut) {
        // Move to next position
        line.age++;
        var nextposition = this.nextPosition(
          positions[(line.age - 1) * 3],
          positions[(line.age - 1) * 3 + 2],
          positions[(line.age - 1) * 3 + 1]
        );
        if (nextposition) {
          positions[line.age * 3] = nextposition.x;
          positions[line.age * 3 + 1] = nextposition.z;
          positions[line.age * 3 + 2] = nextposition.y;
          let v = Math.sqrt(
            nextposition.u ** 2 + nextposition.v ** 2 + nextposition.w ** 2
          );
          let color = this.colorbar[
            Math.round(
              ((v - this.minMax[0]) / (this.minMax[1] - this.minMax[0])) * 100
            )
          ];
          colors[line.age * 4 - 4] = color[0];
          colors[line.age * 4 - 3] = color[1];
          colors[line.age * 4 - 2] = color[2];
          for (let c = 1; c < line.age; c++) {
            colors[c * 4 - 1] = Math.exp(1 - 1 / (c / line.age) ** 2);
          }
          line.geometry.attributes.color.needsUpdate = true;
          line.geometry.setDrawRange(0, line.age);
          line.geometry.attributes.position.needsUpdate = true;
        } else {
          line.age = line.maxAge - this.fadeOut;
        }
      } else if (line.age < line.maxAge) {
        // Fade out line
        line.age++;
        for (let c = 1; c < line.age; c++) {
          colors[c * 4 - 1] = Math.max(
            colors[c * 4 - 1] - colors[c * 4 - 1] / (line.maxAge - line.age),
            0
          );
        }
        line.geometry.attributes.color.needsUpdate = true;
      } else {
        // Reset particle location
        line.age = 0;
        line.maxAge =
          Math.round((this.maxAge - this.fadeOut) * Math.random()) +
          this.fadeOut;
        let pick = this.randomPick[Math.round(pl * Math.random())];
        positions[0] = this.bounds.xMin + this.bounds.xSize * pick[1]; // x
        positions[1] = this.bounds.zMin + this.bounds.zSize * pick[2]; // z
        positions[2] = -this.bounds.yMin + this.bounds.ySize * pick[0]; // -y
        positions[3] = positions[0];
        positions[4] = positions[1];
        positions[5] = positions[2];
        for (let c = 0; c < this.maxAge * 4; c++) {
          colors[c] = 1;
        }
        line.geometry.setDrawRange(0, line.age);
        line.geometry.attributes.position.needsUpdate = true;
        line.geometry.attributes.color.needsUpdate = true;
      }
    }
  };

  nextPosition = (xin, yin, zin) => {
    var i = Math.round((yin - this.bounds.yMin) / this.bounds.ySize);
    var j = Math.round((xin - this.bounds.xMin) / this.bounds.xSize);
    var k = Math.round((zin - this.bounds.zMin) / this.bounds.zSize);
    if (
      i > -1 &&
      i < this.bounds["yLen"] &&
      j > -1 &&
      j < this.bounds["xLen"] &&
      k > -1 &&
      k < this.bounds["zLen"] &&
      this.data[i][j][k][0] !== null
    ) {
      var u = this.data[i][j][k][0];
      var v = this.data[i][j][k][1];
      var w = this.data[i][j][k][2];
      var x = xin + u * this.velocityFactor;
      var y = yin + -v * this.velocityFactor;
      var z = zin + w * this.velocityFactor;
      return { x, y, z, u, v, w };
    } else {
      return false;
    }
  };

  getBinaryColor = (value, min, max, colors) => {
    function trim(s) {
      return s.charAt(0) === "#" ? s.substring(1, 7) : s;
    }
    function convertToRGB(hex) {
      var color = [];
      color[0] = parseInt(trim(hex).substring(0, 2), 16);
      color[1] = parseInt(trim(hex).substring(2, 4), 16);
      color[2] = parseInt(trim(hex).substring(4, 6), 16);
      color[3] = 255;
      return color;
    }
    if (value === null || isNaN(value)) {
      return [255, 255, 255, 0];
    }
    if (value > max) {
      return convertToRGB(colors[colors.length - 1].color);
    }
    if (value < min) {
      return convertToRGB(colors[0].color);
    }
    var loc = (value - min) / (max - min);
    if (loc < 0 || loc > 1) {
      return [255, 255, 255, 0];
    } else {
      var index = 0;
      for (var i = 0; i < colors.length - 1; i++) {
        if (loc >= colors[i].point && loc <= colors[i + 1].point) {
          index = i;
        }
      }
      var color1 = convertToRGB(colors[index].color);
      var color2 = convertToRGB(colors[index + 1].color);

      var f =
        (loc - colors[index].point) /
        (colors[index + 1].point - colors[index].point);
      var rgb = [
        (color1[0] + (color2[0] - color1[0]) * f) / 255,
        (color1[1] + (color2[1] - color1[1]) * f) / 255,
        (color1[2] + (color2[2] - color1[2]) * f) / 255,
        1,
      ];

      return rgb;
    }
  };

  updateColors = (colors) => {
    var colorBar = [];
    for (let i = 0; i < 101; i++) {
      colorBar.push(this.getBinaryColor(i, 0, 99, colors));
    }
    this.colors = colors;
    this.colorBar = colorBar;
  };
}

export default StreamLines;
