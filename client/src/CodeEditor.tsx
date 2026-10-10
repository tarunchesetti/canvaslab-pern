import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'

const extensions = [javascript({ typescript: true })]

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
}

function CodeEditor({ value, onChange }: CodeEditorProps) {
  return (
    <CodeMirror
      className="code-editor nodrag"
      aria-label="Code block editor"
      value={value}
      height="111px"
      extensions={extensions}
      onChange={onChange}
      basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false, bracketMatching: true }}
    />
  )
}

export default CodeEditor
