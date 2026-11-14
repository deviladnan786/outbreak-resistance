const fs = require('fs');

const buf = fs.readFileSync('assets/Shooter Pack/strafe.fbx');
console.log('Size:', buf.length);
// Read FBX binary nodes manually
let offset = 27; // after header (23 bytes) and version (4 bytes)
const version = buf.readUInt32LE(23);
console.log('FBX Version:', version);

function parseNodes(maxNodes = 20) {
  let count = 0;
  while (offset < buf.length && count < maxNodes) {
    let endOffset, numProperties, propertyListLen, nameLen;
    if (version >= 7500) {
      endOffset = Number(buf.readBigUInt64LE(offset));
      numProperties = Number(buf.readBigUInt64LE(offset + 8));
      propertyListLen = Number(buf.readBigUInt64LE(offset + 16));
      nameLen = buf.readUInt8(offset + 24);
      offset += 25;
    } else {
      endOffset = buf.readUInt32LE(offset);
      numProperties = buf.readUInt32LE(offset + 4);
      propertyListLen = buf.readUInt32LE(offset + 8);
      nameLen = buf.readUInt8(offset + 12);
      offset += 13;
    }
    if (endOffset === 0) {
      console.log('Null record at', offset);
      break;
    }
    const name = buf.slice(offset, offset + nameLen).toString('utf8');
    offset += nameLen;
    console.log(`Node: "${name}", endOffset: ${endOffset}, numProps: ${numProperties}`);
    offset = endOffset;
    count++;
  }
}
parseNodes();

