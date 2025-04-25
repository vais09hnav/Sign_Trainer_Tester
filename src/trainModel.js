import * as tf from "@tensorflow/tfjs";
import loadDataset from "./loadDataset";

const trainModel = async () => {
  const { data, labels } = await loadDataset();

  const model = tf.sequential();
  model.add(tf.layers.conv2d({ inputShape: [64, 64, 3], filters: 32, kernelSize: 3, activation: "relu" }));
  model.add(tf.layers.flatten());
  model.add(tf.layers.dense({ units: 26, activation: "softmax" })); 

  model.compile({ optimizer: "adam", loss: "sparseCategoricalCrossentropy", metrics: ["accuracy"] });

  await model.fit(data, labels, { epochs: 10, batchSize: 32 });

  console.log("Training complete!");
  await model.save("localstorage://sign_model"); 

  data.dispose();
  labels.dispose();
};

export default trainModel;
