import React, { Component } from "react";
import * as THREE from "three";
import axios from "axios";
import colorlist from "../../components/colors/colors";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import ColorRamp from "../../components/colors/colorramp";
import Stats from "three/examples/jsm/libs/stats.module.js";
import git from "../home/img/git.png";
import StreamLines from "../../components/3dstreamlines/3dstreamlines";
import "../home/css/home.css";

class Tornado extends Component {
  state = {
    loaded: false,
    bounds: 45,
    zScale: 5,
    xScale: 1,
    yScale: 1,
    timeout: 3000,
    colorTitle: "spectrum",
    colorbar: [],
    min: 0,
    max: 1,
    velocityFactor: 0.5,
    maxAge: 200,
    noParticles: 10000,
    fadeOutPercentage: 0.1,
  };

  downloadLake = async (name) => {
    var { data } = await axios.get(
      "https://dynamiclakes.s3.eu-central-1.amazonaws.com/" + name + ".json",
      {
        onDownloadProgress: (progressEvent) => {
          const percentage = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          document.getElementById("subtext").innerHTML =
            "Downloading velocity field... " + percentage + "%";
        },
      }
    );
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

  async componentDidMount() {
    this.sceneSetup();
    window.addEventListener("resize", this.handleWindowResize);
    var data = await this.downloadLake("tornado4");
    var options = { min: data.min, max: data.max };
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

  componentWillUnmount() {
    window.removeEventListener("resize", this.handleWindowResize);
    window.cancelAnimationFrame(this.requestID);
    this.controls.dispose();
  }

  render() {
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
              <div className="controls fade-in">
                <div className="plotparameters">
                  <div className="plotrow" style={{ marginBottom: "0" }}>
                    <ColorRamp colors={colors} onChange={this.onChangeColors} />
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
                      min={1}
                      type="number"
                      value={noParticles}
                      onChange={(e) => this.onChangeState("noParticles", e)}
                      title="WARNING! Unless your PC is super powerful more than 10000 streams is likely to crash your browser."
                    />
                    <button
                      onClick={this.update}
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
                      onChange={(e) => this.onChangeState("velocityFactor", e)}
                    />
                  </div>
                  <div className="plotrow">
                    Max Age{" "}
                    <input
                      min={1}
                      type="number"
                      value={maxAge}
                      onChange={(e) => this.onChangeState("maxAge", e)}
                    />
                  </div>
                </div>
              </div>
              <div className="about fade-in">
                https://cgl.ethz.ch/research/visualization/data.php
              </div>
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

export default Tornado;
