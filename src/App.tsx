import React from 'react';
import { Home } from './pages/Home/Home';
import { Settings } from './pages/Settings/Settings';
import { Presets } from './pages/Presets/Presets';
import { useAppStore } from './hooks/useAppStore';
import { useFullScreen } from './hooks/useFullScreen';
import { useSound } from './hooks/useSound';
import { ArrowLeft } from 'lucide-react';

export const App: React.FC = () => {
  const store = useAppStore();
  const { isFullScreen, toggle, exit } = useFullScreen();
  const { testSound } = useSound(store.appSettings.sound, store.prefs.muted);

  if (!store.ready) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <h2>ClassSpin</h2>
        <p>Spin • Learn • Have Fun!</p>
      </div>
    );
  }

  return (
    <div className={`app-root ${isFullScreen ? 'is-fullscreen' : ''}`}>
      {store.toast && (
        <div className="toast-notification" role="status">
          {store.toast}
        </div>
      )}

      {store.route === 'wheel' && (
        <Home
          store={store}
          isFullScreen={isFullScreen}
          onToggleFullScreen={() => void toggle()}
          onExitFullScreen={() => void exit()}
        />
      )}

      {store.route === 'settings' && (
        <Settings store={store} onTestSound={testSound} />
      )}

      {store.route === 'presets' && (
        <div className="presets-page-wrapper">
          <div className="presets-topbar">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => store.navigate('wheel')}
            >
              <ArrowLeft size={16} />
              <span>Back to Wheel</span>
            </button>
            <h1>Classroom Wheel Presets</h1>
          </div>
          <div className="presets-content">
            <Presets
              wheels={store.wheels}
              activeId={store.activeId}
              onSelectWheel={store.selectWheel}
              onCreateFromTemplate={store.createFromTemplate}
              onDuplicateWheel={store.duplicateWheel}
              onRenameWheel={store.renameWheel}
              onDeleteWheel={store.deleteWheel}
              onImportWheels={store.addImportedWheels}
              onOpenWheel={() => store.navigate('wheel')}
            />
          </div>
        </div>
      )}
    </div>
  );
};
