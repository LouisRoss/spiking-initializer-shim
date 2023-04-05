const axios = require('axios');
const fs = require('fs');

// Query handlers are called after the first eight bytes of the buffer have been parsed.
//
const HandleGetFullDeployment = function(connection, buffer, configuration) {
  console.log('Handling GetFullModelDeployment command');

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

  const recordFlagInt = buffer.readInt32LE(4, 8 + 160);
  const recordFlag = (recordFlagInt != 0);

  GetFullDeployment(modelName, deploymentName, configuration, recordFlag, 
    fullDeployment => {
      ReturnResponse(connection, fullDeployment);
    }, 
    error => {
      console.log(`Error ${error}`);
    
      var disconnectedResponse = {response:{result:'fail', status: { connected: false, error: error }}};
      connection.write(`Error ${disconnectedResponse}`);
    }
  );
}

const GetFullDeployment = function(modelName, deploymentName, configuration, recordFlag, callback, errorCallback) {
  console.log('GetFullDeployment');

  const packagerConfig = configuration['services']['modelPackager'];
  const packagerHost = packagerConfig.host;
  const packagerPort = packagerConfig.port;

  axios.get(packagerHost + ':' + packagerPort + '/model/' + modelName + '/population')
  .then(populationResponse => {
    axios.get(packagerHost + ':' + packagerPort + '/model/' + modelName + '/deployment/' + deploymentName)
    .then(deploymentResponse => {
      var fullDeployment = [];
      var templateOffset = 0;
      for (var i = 0; i < populationResponse.data.templates.length; i++) {
        const template = populationResponse.data.templates[i];
        const deploymentEngine = deploymentResponse.data[i];

        var neuronCount = 0;
        var layers = [];
        for (const indexName in template.indexes) {
          layers.push([template.indexes[indexName].index, template.indexes[indexName].count]);
          neuronCount += template.indexes[indexName].count;
        }

        fullDeployment.push({'engine': deploymentEngine, 'offset': templateOffset, 'count': neuronCount, 'layers': layers});
        templateOffset += neuronCount;
      }

      console.log(populationResponse.data);
      console.log(deploymentResponse.data);
      
      // Write the file if requested.
      if (recordFlag) {
        const rawdata = fs.readFileSync('/configuration/settings.json');
        const settings = JSON.parse(rawdata);
        console.log(settings);
        
        var recordFilePath = '/record/';
        if ('RecordFilePath' in settings) {
          recordFilePath = settings.RecordFilePath;
        }

        var recordFilename = 'DeploymentMap.json'
        var fullPath = recordFilePath + modelName + '/' + deploymentName + '/' + recordFilename;
        console.log('Recording requested, writing deployment file: ' + fullPath);

        fs.writeFile(fullPath, JSON.stringify(fullDeployment), err => {
          if (err) {
            console.log('Error writing deployment map: ' + err);
          }
        });
      }
      
      // Return the array.
      if (callback) {
        callback(fullDeployment);
      }
    });
  })
  .catch(error => {
    if (errorCallback) { errorCallback(error); }
  });
}

const ReturnResponse = function(connection, deploymentResponse) {
  var totalLength = 0;

  // NOTE: Remove TotalNeuronCount from code that receives this protocol.
  //var totalNeuronCountBuffer = Buffer.alloc(4);
  //totalNeuronCountBuffer.writeUInt32LE(totalNeuronCount);
  //totalLength += 4;

  var populationCountBuffer = Buffer.alloc(4);
  populationCountBuffer.writeUInt32LE(deploymentResponse.length);
  totalLength += 4;

  var deploymentBuffers = [];
  deploymentResponse.forEach(expansion => {
    const paddedEngineName = expansion.engine.padEnd(80, '\0');
    const engineBuffer = Buffer.from(paddedEngineName);
    var offsetBuffer = Buffer.alloc(4);
    offsetBuffer.writeUInt32LE(expansion.offset, 0);
    var countBuffer = Buffer.alloc(4);
    countBuffer.writeUInt32LE(expansion.count, 0);
    
    var expansionBuffer = Buffer.concat([engineBuffer, offsetBuffer, countBuffer]);
    // TODO - Include the layers array, with its element count.
    deploymentBuffers.push(expansionBuffer);
    totalLength += 80 + 4 + 4;
  });
    
  var bufferHeader = Buffer.alloc(4);
  bufferHeader.writeUInt32LE(totalLength);

  console.log(`Sending expansion reply with ${deploymentBuffers.length} populations`);
  var messageBuffer = Buffer.concat([bufferHeader, populationCountBuffer, ...deploymentBuffers], 4 + totalLength);
  //console.log(`Sending reply of ${messageBuffer.length}`);
  //console.log(messageBuffer);

  connection.write(messageBuffer);
}

module.exports = HandleGetFullDeployment;
