ALTER TABLE board_documents
  ALTER COLUMN snapshot SET DEFAULT decode('0000', 'hex');

UPDATE board_documents
SET snapshot = decode('0000', 'hex')
WHERE octet_length(snapshot) = 0;
