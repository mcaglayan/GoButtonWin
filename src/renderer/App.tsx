import { Navigate, Route, Routes } from 'react-router-dom';
import ShowsScreen from './screens/ShowsScreen';
import ShowRunScreen from './screens/ShowRunScreen';
import CueEditScreen from './screens/CueEditScreen';
import SoundBankScreen from './screens/SoundBankScreen';
import { ShowsProvider } from './data/ShowsContext';

export default function App() {
  return (
    <ShowsProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/shows" replace />} />
        <Route path="/shows" element={<ShowsScreen />} />
        <Route path="/soundbank" element={<SoundBankScreen />} />
        <Route path="/shows/:showId" element={<ShowRunScreen />} />
        <Route path="/shows/:showId/soundbank" element={<SoundBankScreen />} />
        <Route path="/shows/:showId/cues/:cueId" element={<CueEditScreen />} />
      </Routes>
    </ShowsProvider>
  );
}
