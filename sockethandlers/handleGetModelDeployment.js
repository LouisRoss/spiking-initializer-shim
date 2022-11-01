const axios = require('axios');

// Query handlers are called after the first eight bytes of the buffer have been parsed.
//
const HandleGetModelDeployment = function(connection, buffer, configuration) {
  console.log('Handling GetModelDeployment command');

  var firstNull = buffer.indexOf(0x00, 8);
  if (firstNull == -1) {
    firstNull = buffer.length;
  }
  const modelName = buffer.toString(undefined, 8, firstNull);
  console.log(`Model name: '${modelName}'`);

  firstNull = buffer.indexOf(0x00, 8 + 80);
  if (firstNull == -1) {
    firstNull = buffer.length;
  }
  const deploymentName = buffer.toString(undefined, 8 + 80, firstNull);
  console.log(`Deployment name: '${deploymentName}'`);

  firstNull = buffer.indexOf(0x00, 8 + 160);
  if (firstNull == -1) {
    firstNull = buffer.length;
  }
  const engineName = buffer.toString(undefined, 8 + 160, firstNull);
  console.log(`Engine name: '${engineName}'`);

  const packagerConfig = configuration['services']['modelPackager'];
  const packagerHost = packagerConfig.host;
  const packagerPort = packagerConfig.port;

  axios.get(packagerHost + ':' + packagerPort + '/model/' + modelName + '/population')
  .then(populationResponse => {
    axios.get(packagerHost + ':' + packagerPort + '/model/' + modelName + '/deployment/' + deploymentName)
    .then(deploymentResponse => {
      var totalNeuronCount = 0;
      var deployment = [];
      for (var i = 0; i < populationResponse.data.templates.length; i++) {
        const template = populationResponse.data.templates[i];
        const deploymentEngine = deploymentResponse.data[i];

        var neuronCount = 0;
        if (deploymentEngine === engineName) {
          for (const indexName in template.indexes) {
            neuronCount += template.indexes[indexName].count;
          }
        }

        totalNeuronCount += neuronCount;
        deployment.push({'engine': deploymentEngine, 'count': neuronCount});
      }

      // Return the array.
      console.log(populationResponse.data);
      console.log(deploymentResponse.data);

      var totalLength = 0;
      var totalNeuronCountBuffer = Buffer.alloc(4);
      totalNeuronCountBuffer.writeUInt32LE(totalNeuronCount);
      totalLength += 4;
  
      var populationCountBuffer = Buffer.alloc(4);
      populationCountBuffer.writeUInt32LE(deployment.length);
      totalLength += 4;
  
      var deploymentBuffers = [];
      deployment.forEach(expansion => {
        var expansionBuffer = Buffer.alloc(84);
        expansionBuffer.from(expansion.engine);  // TODO - truncate to 79 characters.
        expansionBuffer.writeUInt32LE(expansion.count, 80);
        totalLength += 84;
  
        deploymentBuffers.push(expansionBuffer);
      });
        
      var bufferHeader = Buffer.alloc(4);
      bufferHeader.writeUInt32LE(totalLength);
  
      console.log(`Sending expansion reply with ${totalNeuronCount} total neurons and ${deploymentBuffers.length} populations`);
      var messageBuffer = Buffer.concat([bufferHeader, totalNeuronCountBuffer, populationCountBuffer, ...deploymentBuffers], 4 + totalLength);
      //console.log(`Sending reply of ${messageBuffer.length}`);
      //console.log(messageBuffer);
  
      connection.write(messageBuffer);
      //connection.write(JSON.stringify(data.data));
    });
  })
  .catch(error => {
    console.log(`Error ${error}`);
    
    var disconnectedResponse = {response:{result:'ok', status: { connected: false, error: error }}};
    connection.write(`Error ${error}`);
  });
}

module.exports = HandleGetModelDeployment;
