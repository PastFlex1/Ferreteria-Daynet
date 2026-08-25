const fs = require('fs');
let code = fs.readFileSync('src/components/POS/BillingTerminal.tsx', 'utf8');
code = code.replace(
  "import { generateDocumentNumber } from '../../utils/formatters';",
  "import { generateDocumentNumber } from '../../utils/formatters';\nimport { useModal } from '../../context/ModalContext';"
);
fs.writeFileSync('src/components/POS/BillingTerminal.tsx', code);
