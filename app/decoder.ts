// Reference:
// https://github.com/alexzielenski/artFileTool/tree/f82039b84dd6909feadab8f8480c797518ce3039

// ====================
// Tag Descriptors
// ====================
export interface TagDescriptor {
  // Offset for the name of the tag relative to the offset specified in the master header
  nameOffset: number;
  // Tag index. A unique number assigned to the tag to be reference by the file
  // descriptors. The first index should start at 1.
  tagIndex: number;
}

// ====================
// File Descriptors
// ====================
export interface FileDescriptor {
  // Offset of the file data for this tag relative to the one specified in the
  // master header.
  dataOffset: number;

  // 8 bytes of 1 byte indices matching the tag for this resource, if not all
  // 8 spots are used the rest is filled in with 0.
  // tags: [number, number, number, number, number, number, number, number];
  tags: string[];
}

// ====================
// Art Headers
// ====================

export interface ArtHeader {
  // The amount of 'rows' in the image resource.
  numRows: number;
  // The amount of 'columns' in the image resource.
  numColumns: number;
  // 3 groups of 4 groups of 2-byte ints representing a rectangle with x, y,
  // width, height, respectively. The purpose for these rectangles is not yet
  // clear. Essentially this part of the data is just 3 rectangles
  unknownRectangles: Uint8Array;
  // Unknown. Believed to be a type or state of the control used by the system.
  unknownWord: number;

  // 2-byte height of row 0, 1, and 2, respectively
  rowHeights: [number, number, number];
  // 2-byte width of column 0, 1, and 2, respectively
  columnWidths: [number, number, number];

  // Unknown. Referred two as buffer1 within the code. For all of the files so
  // far but 3, the hex of this value is DD 77 which is 30685 in decimal or if
  // you split it up into 2 shorts, it is 221, 119
  buffer1: number;
}

export interface Resource {
  header: ArtHeader;
  descriptor: FileDescriptor;
  data: Uint8Array;
}

export function decode(arrayBuffer: ArrayBuffer) {
  const data = Buffer.from(arrayBuffer);

  // ====================
  // Master Header
  // ====================
  const masterHeader = {
    numResources: data.readUInt16LE(0),
    bitDepth: data.readUInt16LE(2),
    numTags: data.readUInt32LE(4),
    tagDescriptorsOffset: data.readUInt32LE(8),
    tagNamesOffset: data.readUInt32LE(12),
    fileDescriptorsOffset: data.readUInt32LE(16),
    fileDataOffset: data.readUInt32LE(20),
  };

  const tagDescriptors: TagDescriptor[] = [];
  for (let i = 0; i < masterHeader.numTags; i++) {
    // Each descriptor is 8 bytes
    const offset = masterHeader.tagDescriptorsOffset + i * 8;
    tagDescriptors.push({
      nameOffset: data.readUInt32LE(offset),
      tagIndex: data.readUInt32LE(offset + 4),
    });
  }

  // ====================
  // Tag Names
  // ====================
  const tagNames: string[] = [];
  for (const tagDescriptor of tagDescriptors) {
    const offset = masterHeader.tagNamesOffset + tagDescriptor.nameOffset;
    const index = tagDescriptor.tagIndex;
    let name = "";
    // read until you hit a null byte
    for (let i = offset; data[i] !== 0; i++) {
      name += String.fromCharCode(data[i]);
    }
    tagNames[index] = name;
  }

  const fileDescriptors: FileDescriptor[] = [];
  for (let i = 0; i < masterHeader.numResources; i++) {
    // Each descriptor is 12 bytes
    const offset = masterHeader.fileDescriptorsOffset + i * 12;
    fileDescriptors.push({
      dataOffset: data.readUInt32LE(offset),
      tags: [
        data.readUInt8(offset + 4),
        data.readUInt8(offset + 5),
        data.readUInt8(offset + 6),
        data.readUInt8(offset + 7),
        data.readUInt8(offset + 8),
        data.readUInt8(offset + 9),
        data.readUInt8(offset + 10),
        data.readUInt8(offset + 11),
      ]
        // NOTE: To read the tag names, you can use the following
        .filter((byte) => byte !== 0)
        .map((index) => tagNames[index]),
    });
  }

  const resources: Resource[] = [];
  for (let i = 0; i < masterHeader.numResources; i++) {
    const descriptor = fileDescriptors[i];
    const offset = masterHeader.fileDataOffset + descriptor.dataOffset;
    const header: ArtHeader = {
      numRows: data.readUInt16LE(offset),
      numColumns: data.readUInt16LE(offset + 2),
      unknownRectangles: data.subarray(offset + 4, offset + 28),
      unknownWord: data.readUInt16LE(offset + 28),
      rowHeights: [
        data.readUInt16LE(offset + 30),
        data.readUInt16LE(offset + 32),
        data.readUInt16LE(offset + 34),
      ],
      columnWidths: [
        data.readUInt16LE(offset + 36),
        data.readUInt16LE(offset + 38),
        data.readUInt16LE(offset + 40),
      ],
      buffer1: data.readUInt16LE(offset + 42),
    };

    // Unsure if it's 44 or 104 on Lion
    const dataOffset = offset + 44;

    const width = header.columnWidths.reduce((a, b) => a + b, 0);
    const height = header.rowHeights.reduce((a, b) => a + b, 0);
    const dataLength = width * height * 4;

    const fileData = data.subarray(dataOffset, dataOffset + dataLength);
    resources.push({ header, descriptor, data: fileData });
  }

  return resources;
}
