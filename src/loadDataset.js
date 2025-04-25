import * as tf from "@tensorflow/tfjs";

const loadDataset = async () => {
  const classes = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");  
  let data = [], labels = [];

  for (let i = 0; i < classes.length; i++) {
    const letter = classes[i];

    for (let j = 1; j <= 1000; j++) { // Assuming 1000 images per class
      const imgPath = `${process.env.PUBLIC_URL}/dataset/${letter}/${j}.jpg`;

      const img = new Image();
      img.src = imgPath;
      await new Promise((resolve) => (img.onload = resolve));

      const tensor = tf.browser.fromPixels(img)
        .resizeNearestNeighbor([64, 64])  
        .toFloat()
        .expandDims();  

      data.push(tensor);
      labels.push(i); 
    }
  }

  return {
    data: tf.stack(data),
    labels: tf.tensor(labels)
  };
};

export default loadDataset;
