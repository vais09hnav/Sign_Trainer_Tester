import React, { useEffect } from "react";
import SignTrainer from "./SignTrainer";
import trainModel from "./trainModel";
import SignTester from "./SignTester";

const App = () => {
  useEffect(() => {
    trainModel();
  }, []);

  return (
    <div>
      <SignTrainer />
      <SignTester/>
      
    </div>
  );
};

export default App;
