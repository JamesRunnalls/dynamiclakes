import React, { Component } from "react";
import Viewer from "../../components/viewer/viewer";

class Tornado extends Component {
  process = (data) => {
    data.bounds.zMin = -20.0;
    data.bounds.zMax = 20.0;
    return data;
  };
  render() {
    document.title = "Tornado";
    var reference = "https://cgl.ethz.ch/research/visualization/data.php";
    var url =
      "https://dynamiclakes.s3.eu-central-1.amazonaws.com/tornado4.json";
    return <Viewer url={url} bottomLeft={reference} process={this.process} />;
  }
}

export default Tornado;
