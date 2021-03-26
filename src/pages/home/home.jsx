import React, { Component } from "react";
import * as THREE from "three";
import Delaunator from "delaunator";
import axios from "axios";
import * as d3 from "d3";
import colorlist from "../../components/colors/colors";
import { getBinaryColor } from "../../components/gradients/gradients";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { apiUrl } from "../../config.json";
import "./css/home.css";

class ScaleBox extends Component {
  render() {
    var { label, value, onChange } = this.props;
    return (
      <table className="scale-box">
        <tbody>
          <tr>
            <td>{label}</td>
            <td>
              <input type="number" value={value} onChange={onChange} />
            </td>
          </tr>
        </tbody>
      </table>
    );
  }
}

class Home extends Component {
  state = {
    loaded: false,
    bounds: 45,
    zScale: 40,
    xScale: 1,
    yScale: 1,
    quadtreeSensitivity: 0.5,
    velocityFactor: 2,
    maxAge: 200,
    noParticles: 10000,
    fadeOutPercentage: 0.1,
  };

  downloadLake = async (name) => {
    var { data } = await axios.get(apiUrl + "/externaldata/threed/" + name, {
      onDownloadProgress: (progressEvent) => {
        const percentage = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        document.getElementById("subtext").innerHTML =
          "Downloading velocity field... " + percentage + "%";
      },
    });
    return data;
  };

  globalToLocalCoordinate = (depths, arr) => {
    var { bounds, zScale, xScale, yScale } = this.state;
    let x_array = arr.map((q) => q[0]);
    let y_array = arr.map((q) => q[1]);

    let min_x = Math.min(...x_array);
    let min_y = Math.min(...y_array);
    let min_z = Math.min(...depths);
    let max_x = Math.max(...x_array);
    let max_y = Math.max(...y_array);
    let max_z = Math.max(...depths);
    let dif_x = max_x - min_x;
    let dif_y = max_y - min_y;

    var ybound, xbound, zbound;
    if (dif_x > dif_y) {
      xbound = bounds * xScale;
      ybound = bounds * ((max_y - min_y) / (max_x - min_x)) * yScale;
      zbound = bounds * ((max_z - min_z) / (max_x - min_x)) * zScale;
    } else {
      ybound = bounds * yScale;
      xbound = bounds * ((max_x - min_x) / (max_y - min_y)) * xScale;
      zbound = bounds * ((max_z - min_z) / (max_y - min_y)) * zScale;
    }

    var min = {
      x: -xbound,
      y: -ybound,
      z: -zbound,
    };
    var max = { x: xbound, y: ybound, z: 0 };

    depths = depths.map(
      (d) => min.z + ((d - min_z) / (max_z - min_z)) * (max.z - min.z)
    );

    arr = arr.map((a) => {
      a[0] = min.x + ((a[0] - min_x) / (max_x - min_x)) * (max.x - min.x);
      a[1] = min.y + ((a[1] - min_y) / (max_y - min_y)) * (max.y - min.y);
      return a;
    });
    return { depths, arr };
  };

  dataProperties = (depths, arr) => {
    var randomPick = [];
    var bottomSurface = [];
    var depth_len = depths.length;
    var arr_len = arr.length;
    var minVelocity = 999;
    var maxVelocity = 0;
    for (let i = 0; i < arr_len; i++) {
      let depth = 0;
      for (let j = 0; j < depth_len; j++) {
        if (arr[i][2][j] !== -999 && arr[i][3][j] !== -999) {
          randomPick.push([i, j]);
          let velocity = Math.sqrt(arr[i][2][j] ** 2 + arr[i][3][j] ** 2);
          minVelocity = Math.min(velocity, minVelocity);
          maxVelocity = Math.max(velocity, maxVelocity);
        } else {
          break;
        }
        depth = depths[j];
      }
      bottomSurface.push({ x: arr[i][0], y: arr[i][1], z: depth });
    }
    return { randomPick, bottomSurface, minVelocity, maxVelocity };
  };

  initialPositions = () => {
    var { arr, randomPick, depths } = this.state;
    var pl = randomPick.length - 1;
    this.lines.forEach((line) => {
      let pick = randomPick[Math.round(pl * Math.random())];
      let positions = line.data.geometry.attributes.position.array;
      positions[0] = arr[pick[0]][0]; // x
      positions[1] = depths[pick[1]]; // z
      positions[2] = -arr[pick[0]][1]; // -y
      positions[3] = positions[0];
      positions[4] = positions[1];
      positions[5] = positions[2];
      line.data.geometry.attributes.position.needsUpdate = true;
    });
  };

  indexOfClosest = (num, arr) => {
    var index = 0;
    var diff = Math.abs(num - arr[0]);
    for (var val = 0; val < arr.length; val++) {
      var newdiff = Math.abs(num - arr[val]);
      if (newdiff < diff) {
        diff = newdiff;
        index = val;
      }
    }
    return index;
  };

  dataToGrid = (arr, radius) => {
    function createAndFillTwoDArray({ rows, columns, defaultValue }) {
      return Array.from({ length: rows }, () =>
        Array.from({ length: columns }, () => defaultValue)
      );
    }

    var data = JSON.parse(JSON.stringify(arr));

    var nCols = 200;
    var nRows = 200;

    let x_array = data.map((df) => df[0]);
    let y_array = data.map((df) => df[1]);

    let min_x = Math.min(...x_array);
    let min_y = Math.min(...y_array);
    let max_x = Math.max(...x_array);
    let max_y = Math.max(...y_array);

    let xSize = (max_x - min_x) / nCols;
    let ySize = (max_y - min_y) / nRows;

    let quadtree = d3
      .quadtree()
      .extent([
        [min_x, min_y],
        [max_x, max_y],
      ])
      .addAll(data);

    var outdata = createAndFillTwoDArray({
      rows: nRows + 1,
      columns: nCols + 1,
      defaultValue: null,
    });
    var x, y;
    for (var i = 0; i < nRows + 1; i++) {
      y = max_y - i * ySize;
      for (var j = 0; j < nCols + 1; j++) {
        x = min_x + j * xSize;
        let quad = quadtree.find(x, y, radius);
        if (quad !== undefined) {
          outdata[i][j] = [
            JSON.parse(JSON.stringify(quad[2])),
            JSON.parse(JSON.stringify(quad[3])),
          ];
        }
      }
    }
    return {
      nCols,
      nRows,
      xSize,
      ySize,
      xllcorner: min_x,
      yllcorner: min_y,
      griddata: outdata,
      quadtree,
    };
  };

  generateColorBar = (arr) => {
    var colors;
    for (let color of colorlist) {
      if (color.name === "Paraview") {
        colors = color.data;
      }
    }
    var colorbar = [];
    for (let i = 0; i < 100; i++) {
      colorbar.push(getBinaryColor(i, 0, 99, colors));
    }
    return colorbar;
  };

  nextPosition = (xin, yin, zin) => {
    let {
      xSize,
      ySize,
      xllcorner,
      yllcorner,
      nCols,
      nRows,
      griddata,
      velocityFactor,
      depths,
    } = this.state;
    var zi = this.indexOfClosest(zin, depths);
    var i = Math.round((yin - yllcorner) / ySize);
    var j = Math.round((xin - xllcorner) / xSize);
    if (i > -1 && i < nRows && j > -1 && j < nCols && griddata[i][j] !== null) {
      var u = 0;
      var v = 0;
      if (griddata[i][j][0].length > 0 && griddata[i][j][0][zi] !== -999)
        u = griddata[i][j][0][zi];
      if (griddata[i][j][1].length > 0 && griddata[i][j][1][zi] !== -999)
        v = griddata[i][j][1][zi];
      var x = xin + u * velocityFactor;
      var y = yin + -v * velocityFactor;
      return { x, y, z: zin, u, v };
    } else {
      return false;
    }
  };

  updatePositions = () => {
    var {
      arr,
      randomPick,
      depths,
      minVelocity,
      maxVelocity,
      colorbar,
    } = this.state;
    var pl = randomPick.length - 1;
    var line_len = this.lines.length;
    for (let i = 0; i < line_len; i++) {
      let line = this.lines[i];
      let positions = line.data.geometry.attributes.position.array;
      let colors = line.data.geometry.attributes.color.array;
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
          let color =
            colorbar[
              Math.round(
                Math.sqrt(nextposition.u ** 2 + nextposition.v ** 2) /
                  (maxVelocity - minVelocity)
              )
            ];
          colors[line.age * 4 - 4] = color[0];
          colors[line.age * 4 - 3] = color[1];
          colors[line.age * 4 - 2] = color[2];
          for (let c = 1; c < line.age; c++) {
            colors[c * 4 - 1] = Math.exp(1 - 1 / (c / line.age) ** 2);
          }
          line.data.geometry.attributes.color.needsUpdate = true;
          line.data.geometry.setDrawRange(0, line.age);
          line.data.geometry.attributes.position.needsUpdate = true;
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
        line.data.geometry.attributes.color.needsUpdate = true;
      } else {
        // Reset particle location
        line.age = 0;
        line.maxAge =
          Math.round((this.maxAge - this.fadeOut) * Math.random()) +
          this.fadeOut;
        let pick = randomPick[Math.round(pl * Math.random())];
        positions[0] = arr[pick[0]][0]; // x
        positions[1] = depths[pick[1]]; // z
        //positions[1] = 0; // z
        positions[2] = -arr[pick[0]][1]; // -y
        positions[3] = positions[0] + 0.1;
        positions[4] = positions[1] + 0.1;
        positions[5] = positions[2] + 0.1;
        for (let c = 0; c < this.maxAge * 4; c++) {
          colors[c] = 1;
        }
        line.data.geometry.setDrawRange(0, line.age);
        line.data.geometry.attributes.position.needsUpdate = true;
        line.data.geometry.attributes.color.needsUpdate = true;
      }
    }
  };

  removeOuterTriangles(indexDelaunay, maxVertex) {
    let newTriangles = [];
    for (let k = 0; k < indexDelaunay.triangles.length; k += 3) {
      let t0 = indexDelaunay.triangles[k];
      let t1 = indexDelaunay.triangles[k + 1];
      let t2 = indexDelaunay.triangles[k + 2];

      let x0 = indexDelaunay.coords[2 * t0];
      let y0 = indexDelaunay.coords[2 * t0 + 1];

      let x1 = indexDelaunay.coords[2 * t1];
      let y1 = indexDelaunay.coords[2 * t1 + 1];

      let x2 = indexDelaunay.coords[2 * t2];
      let y2 = indexDelaunay.coords[2 * t2 + 1];

      let va = Math.abs(Math.sqrt((y1 - y0) ** 2 + (x1 - x0) ** 2));
      let vb = Math.abs(Math.sqrt((y2 - y1) ** 2 + (x2 - x1) ** 2));
      let vc = Math.abs(Math.sqrt((y2 - y0) ** 2 + (x2 - x0) ** 2));

      if (va < maxVertex && vb < maxVertex && vc < maxVertex) {
        newTriangles.push(t0, t1, t2);
      }
    }
    indexDelaunay.triangles = newTriangles;
    return indexDelaunay;
  }

  handleWindowResize = () => {
    const width = this.mount.clientWidth;
    const height = this.mount.clientHeight;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  sceneSetup = () => {
    var { maxAge, noParticles, fadeOutPercentage } = this.state;
    const width = this.mount.clientWidth;
    const height = this.mount.clientHeight;

    this.maxAge = maxAge;
    this.noParticles = noParticles;
    this.fadeOut = Math.round(this.maxAge * fadeOutPercentage);

    this.scene = new THREE.Scene();
    //this.scene.background = new THREE.Color(0x000000);
    this.camera = new THREE.PerspectiveCamera(
      75, // fov = field of view
      width / height, // aspect ratio
      0.1, // near plane
      1000 // far plane
    );
    this.camera.position.z = 55;
    this.camera.position.x = 5;
    this.camera.position.y = 15;
    this.controls = new OrbitControls(this.camera, this.mount);
    this.controls.maxPolarAngle = Math.PI / 2;
    this.renderer = new THREE.WebGLRenderer({ alpha: true });
    this.renderer.setSize(width, height);
    this.mount.appendChild(this.renderer.domElement);

    this.stats = new Stats();
    //this.stats.showPanel( 1 );
    document.body.appendChild(this.stats.domElement);
  };

  addCustomSceneObjects = () => {
    var { bottomSurface } = this.state;
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

    // Lake Mesh
    var points3d = [];
    for (let i = 0; i < bottomSurface.length; i++) {
      points3d.push(
        new THREE.Vector3(
          bottomSurface[i].x,
          bottomSurface[i].z,
          -bottomSurface[i].y
        )
      );
    }

    var lakegeometry = new THREE.BufferGeometry().setFromPoints(points3d);

    var indexDelaunay = Delaunator.from(
      points3d.map((v) => {
        return [v.x, v.z];
      })
    );

    // Remove triangle with vertex over certain length
    indexDelaunay = this.removeOuterTriangles(indexDelaunay, 2);

    var meshIndex = []; // delaunay index => three.js index
    for (let i = 0; i < indexDelaunay.triangles.length; i++) {
      meshIndex.push(indexDelaunay.triangles[i]);
    }

    lakegeometry.setIndex(meshIndex);
    var mesh = new THREE.Mesh(
      lakegeometry, // re-use the existing geometry
      new THREE.MeshBasicMaterial({
        color: "white",
        wireframe: false,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
      })
    );
    this.scene.add(mesh);

    // geometry
    var geometry = new THREE.BufferGeometry();

    var colors = new Array(this.maxAge * 4).fill(1);
    geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 4, true)
    );

    var positions = new Float32Array(this.maxAge * 3); // 3 vertices per point
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    // Set draw range
    geometry.setDrawRange(0, 0);

    // Material
    var material = new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
    });
    this.lines = [];

    for (var p = 0; p < this.noParticles; p++) {
      let line = new THREE.Line(geometry.clone(), material.clone());
      this.lines.push({
        data: line,
        age: 0,
        maxAge:
          Math.round((this.maxAge - this.fadeOut) * Math.random()) +
          this.fadeOut,
      });
      this.scene.add(line);
    }

    // update positions
    this.initialPositions();

    var light = new THREE.AmbientLight(0x404040);
    this.scene.add(light);
  };

  startAnimationLoop = () => {
    this.updatePositions();
    this.renderer.render(this.scene, this.camera);
    this.requestID = window.requestAnimationFrame(this.startAnimationLoop);
    this.stats.update();
  };

  async componentDidMount() {
    var lake = "geneva";
    var url_lake = this.props.location.pathname.split("/").slice(-1)[0];
    if (["zurich", "geneva"].includes(url_lake)) {
      lake = url_lake;
    }

    var { quadtreeSensitivity } = this.state;

    var { depths, arr } = await this.downloadLake(lake);
    ({ depths, arr } = this.globalToLocalCoordinate(depths, arr));
    var colorbar = this.generateColorBar(arr);
    var {
      randomPick,
      bottomSurface,
      minVelocity,
      maxVelocity,
    } = this.dataProperties(depths, arr);

    var {
      nCols,
      nRows,
      xSize,
      ySize,
      xllcorner,
      yllcorner,
      griddata,
      quadtree,
    } = this.dataToGrid(arr, quadtreeSensitivity);

    this.setState(
      {
        nCols,
        nRows,
        xSize,
        ySize,
        xllcorner,
        yllcorner,
        griddata,
        arr,
        depths,
        randomPick,
        bottomSurface,
        quadtree,
        colorbar,
        minVelocity,
        maxVelocity,
      },
      () => {
        var subtext = document.getElementById("subtext");
        subtext.innerHTML = "Plotting velocity field... ";
        subtext.classList.add("fade-out");
        document.getElementById("text").classList.add("fade-out");
        setTimeout(() => {
          this.setState({ loaded: true });
        }, 2000);
        this.sceneSetup();
        this.addCustomSceneObjects();
        this.startAnimationLoop();

        window.addEventListener("resize", this.handleWindowResize);
      }
    );
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this.handleWindowResize);
    window.cancelAnimationFrame(this.requestID);
    this.controls.dispose();
  }

  render() {
    var { loaded, xScale, yScale, zScale, noParticles, velocityFactor, maxAge } = this.state;
    document.title = "Dynamic Lakes";
    return (
      <React.Fragment>
        <div className="main">
          {loaded && (
            <div className="about fade-in">
              Dynamic lakes uses the output simulations results from the
              Meteolakes project, in order to display 3D stream lines.
              <div className="plotparameters">
                <div className="plotrow">
                  Scale
                  <ScaleBox label="x" value={xScale} />
                  <ScaleBox label="y" value={yScale} />
                  <ScaleBox label="z" value={zScale} />
                </div>
                <div className="plotrow">
                  Streams <input type="number" value={noParticles} />
                </div>
                <div className="plotrow">
                  Velocity <input type="number" value={velocityFactor} />
                </div>
                <div className="plotrow">
                  Max Age <input type="number" value={maxAge} />
                </div>
              </div>
            </div>
          )}

          <div className="threeviewer" ref={(ref) => (this.mount = ref)}>
            {!loaded && (
              <div className="pagecenter">
                <div className="loading-text" id="text">
                  Welcome to Dynamic Lakes
                </div>
                <div className="loading-subtext" id="subtext">
                  Waiting for response from server...
                </div>
              </div>
            )}
          </div>
        </div>
      </React.Fragment>
    );
  }
}

export default Home;
