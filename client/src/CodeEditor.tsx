import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'

const extensions = [javascript({ typescript: true })]

interface CodeEditorProps {
  value: string
  readOnly?: boolean
  onChange: (value: string) => void
}

function CodeEditor({ value, readOnly = false, onChange }: CodeEditorProps) {
  return (
    <CodeMirror
      className="code-editor nodrag"
      aria-label="Code block editor"
      value={value}
      readOnly={readOnly}
      editable={!readOnly}
      height="111px"
      extensions={extensions}
      onChange={onChange}
      basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false, bracketMatching: true }}
    />
  )
}

export default CodeEditor
