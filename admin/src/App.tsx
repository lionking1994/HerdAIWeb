import { BrowserRouter as Router } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import { AuthProvider } from './contexts/AuthContext';
import Routes from './routes';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  return (
    <Provider store={store}>
      <AuthProvider>
        <ToastContainer />
        <Router basename='/admin'>
          <Routes />
        </Router>
      </AuthProvider>
    </Provider>
  );
}

export default App;
