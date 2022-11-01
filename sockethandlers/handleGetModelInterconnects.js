const axios = require('axios');

// Query handlers are called after the first eight bytes of the buffer have been parsed.
//
const HandleGetModelInterconnects = function(connection, buffer, configuration) {
  console.log('Handling GetModelInterconnects command');

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

  axios.get(packagerHost + ':' + packagerPort + '/model/' + modelName + '/interconnects')
  .then(interconnectResponse => {
    const interconnectCount = interconnectResponse.data.length;
    var interconnects = [];
    for (var i = 0; i < interconnectCount; i++) {
      const interconnect = interconnectResponse.data[i];
      interconnects.push(
        [
          interconnect.FromIndex,
          interconnect.FromOffset,
          interconnect.FromCount,
          interconnect.ToIndex,
          interconnect.ToOffset,
          interconnect.ToCount
        ]);
    }

    // Return the array.
    console.log(interconnectResponse.data);

    var totalLength = 0;
    var totalInterconnectCountBuffer = Buffer.alloc(4);
    totalInterconnectCountBuffer.writeUInt32LE(interconnectCount);
    totalLength += 4;

    var interconnectBuffers = [];
    interconnects.forEach(interconnect => {
      var interconnectBuffer = Buffer.alloc(6 * 4);
      interconnectBuffer.writeUInt32LE(interconnect.FromIndex, 0);
      interconnectBuffer.writeUInt32LE(interconnect.FromOffset, 4);
      interconnectBuffer.writeUInt32LE(interconnect.FromCount, 8);
      interconnectBuffer.writeUInt32LE(interconnect.ToIndex, 12);
      interconnectBuffer.writeUInt32LE(interconnect.ToOffset, 16);
      interconnectBuffer.writeUInt32LE(interconnect.ToCount, 20);
      totalLength += 6 * 4;

      interconnectBuffers.push(interconnectBuffer);
    });
      
    var bufferHeader = Buffer.alloc(4);
    bufferHeader.writeUInt32LE(totalLength);

    console.log(`Sending interconnects reply with ${interconnectCount} interconnections`);
    var messageBuffer = Buffer.concat([bufferHeader, totalInterconnectCountBuffer, ...interconnectBuffers], 4 + totalLength);
    //console.log(`Sending reply of ${messageBuffer.length}`);
    //console.log(messageBuffer);

    connection.write(messageBuffer);
    //connection.write(JSON.stringify(data.data));
  })
  .catch(error => {
    console.log(`Error ${error}`);
    
    var disconnectedResponse = {response:{result:'ok', status: { connected: false, error: error }}};
    connection.write(`Error ${error}`);
  });
}

module.exports = HandleGetModelInterconnects;
