// Utility Functions
function createEnum(values) {
    const enumObject = {};
    for (const val of values) {
        enumObject[val] = val;
    }
    return Object.freeze(enumObject);
}

function randomInt(minimum, maximum) {
    return Math.floor((Math.random() * (maximum - minimum)) + minimum);
}

// this sets a specific bit to 1 or 0 
const setBit = (n, bitIndex) => {
    const bitMask = 1 << bitIndex;
    return n | bitMask;
}

function logToPage(message) {
  const logOutput = document.getElementById('log-output');
  if (logOutput) {
    logOutput.insertAdjacentHTML('beforeend', `<p>> ${message}</p>`);
    // Auto-scroll to the bottom
    logOutput.scrollTop = logOutput.scrollHeight;
  }
  // We can also keep logging to the browser console for debugging
  console.log(message);
}

function mutateGeneBit(geneHex) {
  // Parse hex string to integer
  let geneInt = parseInt(geneHex, 16);
  const bitToFlip = Math.floor(Math.random() * 32); // Genes are 32 bits
  const mask = 1 << bitToFlip;
  geneInt ^= mask; // XOR to flip the bit
  // Return as hex string, ensuring 8 characters
  return geneInt.toString(16).padStart(8, '0').toUpperCase();
}

export { createEnum, randomInt, setBit, mutateGeneBit, logToPage };
