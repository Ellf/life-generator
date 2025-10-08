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

export { createEnum, randomInt, setBit, logToPage };
