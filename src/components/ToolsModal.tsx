// Quick tools from the + menu: summarize a YouTube video, bring a web page into the chat, or calculate with
// Gemini's Python. Each prepares a message for you to check and send.
import FreeTools, { type Tool } from './FreeTools';
import Modal from './Modal';


export default function ToolsModal({ initial, onClose }: { initial: Tool; onClose: () => void }) {
  return (
    <Modal title="Quick tools" onClose={onClose}>
      <div className="tools-modal"><FreeTools initial={initial} onClose={onClose} /></div>
    </Modal>
  );
}
