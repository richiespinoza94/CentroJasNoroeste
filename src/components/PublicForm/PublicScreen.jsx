import { useStore } from '../../state/store.jsx';
import RegistrationForm from './RegistrationForm.jsx';
import ConfirmationScreen from './ConfirmationScreen.jsx';
import './PublicScreen.css';

// Rendered at real mobile viewport width — no fake device bezel. The
// prototype wrapped this in a Claude Design iPhone mockup (ios-frame.jsx)
// purely so it previewed nicely on the design canvas; shipping that chrome
// into production would just add dead weight and a fake status bar that
// disagrees with the visitor's actual phone.
export default function PublicScreen() {
  const { state } = useStore();
  return <div className="public-screen">{state.formStep === 'form' ? <RegistrationForm /> : <ConfirmationScreen />}</div>;
}
