import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'

const extensions = [javascript({ typescript: true })]

interface CodeEditorProps {
  value: string
  language?: 'typescript' | 'javascript'
  readOnly?: boolean
  onChange: (value: string) => void
}

function CodeEditor({ value, language = 'typescript', readOnly = false, onChange }: CodeEditorProps) {
  return (
    <CodeMirror
      className="code-editor nodrag"
      aria-label="Code block editor"
      value={value}
      readOnly={readOnly}
      editable={!readOnly}
      height="111px"
      extensions={[javascript({ typescript: language === 'typescript' })]}
      onChange={onChange}
      basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false, bracketMatching: true }}
    />
  )
}

export default CodeEditor
