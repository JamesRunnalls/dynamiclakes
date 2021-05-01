import * as THREE from "three";

module.exports = class StreamLines {
  constructor(data, bounds, options = {}) {
    this.data = this.verfiyData(data);
    this.bounds = this.computeBounds(data, bounds);

    this.noParticles = options.noParticles || 5000;
    this.maxAge = options.maxAge || 200;
    this.fadeOut = options.fadeOut || 0.1;

    this.minMax = options.minMax || this.getMinMax();

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
    return bounds
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

    this.fadeOutTime = Math.round(this.maxAge * this.fadeOut);
    var geometry = new THREE.BufferGeometry();

    var colors = new Array(maxAge * 4).fill(1);
    geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 4, true)
    );

    var positions = new Float32Array(maxAge * 3);
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
        Math.round((this.maxAge - this.fadeOutTime) * Math.random()) +
        this.fadeOutTime;
      this.streamlines.add(line);
    }
  };

  initialPositions = () => {
    var { arr, randomPick, depths } = this.state;

    var pl = this.randomPick.length - 1;
    for (var i = 0; i < this.streamlines.children.length; i++) {
      let line = this.streamlines.children[i];
      let pick = this.randomPick[Math.round(pl * Math.random())];
      let positions = line.geometry.attributes.position.array;
      positions[0] = arr[pick[0]][0]; // x
      positions[1] = depths[pick[1]]; // z
      positions[2] = -arr[pick[0]][1]; // -y
      positions[3] = positions[0];
      positions[4] = positions[1];
      positions[5] = positions[2];
      line.geometry.attributes.position.needsUpdate = true;
    }
  };
};
