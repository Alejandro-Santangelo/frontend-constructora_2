import { configureStore } from '@reduxjs/toolkit';

// Store súper simple que no interfiere con nada
const phantomStore = configureStore({
  reducer: {
    // Reducer fantasma que no hace nada
    phantom: (state = { initialized: true }, action) => state
  }
});

export default phantomStore;