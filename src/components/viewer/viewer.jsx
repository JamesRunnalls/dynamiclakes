import React, { Component } from "react";
import * as THREE from "three";
import axios from "axios";
import colorlist from "../colors/colors";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import ColorRamp from "../colors/colorramp";
import Stats from "three/examples/jsm/libs/stats.module.js";
import git from "./img/git.png";
import StreamLines from "../3dstreamlines/3dstreamlines";
import "./viewer.css";

class Viewer extends Component {
  state = {
    loaded: false,
    colorTitle: "spectrum",
    min: 0,
    max: 1,
    velocityFactor: 0.5,
    maxAge: 200,
    noParticles: 10000,
    fadeOutPercentage: 0.1,
  };

  downloadLake = async (url) => {
    var { data } = await axios.get(url, {
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

  sceneSetup = () => {
    const width = this.mount.clientWidth;
    const height = this.mount.clientHeight;

    this.scene = new THREE.Scene();
    //this.scene.background = new THREE.Color(0x000000);
    this.camera = new THREE.PerspectiveCamera(
      75, // fov = field of view
      width / height, // aspect ratio
      0.1, // near plane
      1000 // far plane
    );
    this.camera.position.z = 55;
    this.camera.position.x = 15;
    this.camera.position.y = 35;
    this.controls = new OrbitControls(this.camera, this.mount);
    this.controls.maxPolarAngle = Math.PI / 2;
    this.renderer = new THREE.WebGLRenderer({ alpha: true });
    this.renderer.setSize(width, height);
    this.mount.appendChild(this.renderer.domElement);

    var light = new THREE.AmbientLight(0x404040);
    this.scene.add(light);

    this.stats = new Stats();
    document.body.appendChild(this.stats.domElement);
  };

  setColors = (colorTitle) => {
    var colors = colorlist.find((c) => c.name === colorTitle).data;
    this.streamlines.setColors(colors);
    this.setState({ colorTitle });
  };

  setMaxAge = (event) => {
    var maxAge = event.target.value;
    this.setState({ maxAge });
    if (maxAge > 0) {
      this.streamlines.setMaxAge(maxAge);
    }
  };

  setVelocityFactor = (event) => {
    var velocityFactor = event.target.value;
    this.setState({ velocityFactor });
    if (velocityFactor > 0) {
      this.streamlines.setVelocityFactor(velocityFactor);
    }
  };

  updateNoParticles = (event) => {
    var noParticles = event.target.value;
    if (noParticles > 10000) {
      alert(
        "Most computers struggle to display more than 10,000 particles. Plotting " +
          noParticles +
          " may crash your browser."
      );
    }
    this.setState({ noParticles });
  };

  setNoParticles = () => {
    var { noParticles } = this.state;
    if (noParticles > 0) {
      this.streamlines.setNoParticles(noParticles);
    }
  };

  async componentDidMount() {
    var { url, process } = this.props;
    var { colorTitle } = this.state;
    this.sceneSetup();
    window.addEventListener("resize", this.handleWindowResize);
    var data = await this.downloadLake(url);
    if (process) data = process(data);
    var colors = colorlist.find((c) => c.name === colorTitle).data;
    var options = { min: data.min, max: data.max, colors };
    this.streamlines = new StreamLines(
      data.grid,
      data.bounds,
      this.scene,
      options
    );
    this.startAnimationLoop();
    this.setState({ loaded: true, min: data.min, max: data.max });
  }

  startAnimationLoop = () => {
    this.streamlines.animate();
    this.renderer.render(this.scene, this.camera);
    this.requestID = window.requestAnimationFrame(this.startAnimationLoop);
    this.stats.update();
  };

  componentDidUpdate = (prevProps, prevState) => {
    if (prevProps.url !== this.props.url) {
    }
  };

  componentWillUnmount() {
    window.removeEventListener("resize", this.handleWindowResize);
    window.cancelAnimationFrame(this.requestID);
    this.controls.dispose();
  }

  render() {
    var { bottomLeft, topLeft } = this.props;
    var {
      loaded,
      noParticles,
      velocityFactor,
      maxAge,
      mesh,
      colorTitle,
      min,
      max,
    } = this.state;
    var colors = colorlist.find((c) => c.name === colorTitle).data;
    document.title = "Dynamic Lakes - A day in the life of Lake Geneva";
    return (
      <React.Fragment>
        <div className="main">
          {loaded && (
            <React.Fragment>
              <div className="time fade-in">{topLeft}</div>
              <div className="controls fade-in">
                <div className="plotparameters">
                  <div className="plotrow" style={{ marginBottom: "0" }}>
                    <ColorRamp colors={colors} onChange={this.setColors} />
                    <table className="color-values">
                      <tbody>
                        <tr>
                          <td style={{ textAlign: "left", width: "20%" }}>
                            {Math.floor(min * 100) / 100}
                          </td>
                          <td style={{ textAlign: "center", width: "60%" }}>
                            Velocity (m/s)
                          </td>
                          <td style={{ textAlign: "right", width: "20%" }}>
                            {Math.ceil(max * 100) / 100}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="plotrow">
                    View Boundary
                    <input
                      type="checkbox"
                      checked={mesh}
                      onChange={this.toggleMesh}
                    />
                  </div>
                  <div className="plotrow">
                    Streams{" "}
                    <input
                      type="number"
                      value={noParticles}
                      onChange={this.updateNoParticles}
                      title="WARNING! Unless your PC is super powerful more than 10000 streams is likely to crash your browser."
                    />
                    <button
                      onClick={this.setNoParticles}
                      title="Update number of streams"
                    >
                      &#8635;
                    </button>
                  </div>
                  <div className="plotrow">
                    Velocity{" "}
                    <input
                      min={1}
                      type="number"
                      value={velocityFactor}
                      onChange={this.setVelocityFactor}
                    />
                  </div>
                  <div className="plotrow">
                    Max Age{" "}
                    <input
                      min={1}
                      type="number"
                      value={maxAge}
                      onChange={this.setMaxAge}
                    />
                  </div>
                </div>
              </div>
              <div className="bottomLeft fade-in">{bottomLeft}</div>
              <div className="git fade-in">
                <a
                  title="Check out the project on GitHub"
                  href="https://github.com/JamesRunnalls/dynamiclakes"
                >
                  <img src={git} alt="git" />
                </a>
              </div>
            </React.Fragment>
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

export default Viewer;
