const fs = require('fs');
const path = require('path');

const files = [
  'src/components/Accounting/AccountingManager.tsx',
  'src/components/Assets/AssetsManager.tsx',
  'src/components/Customers/CustomerManager.tsx',
  'src/components/Finance/FinanceManager.tsx',
  'src/components/HR/HRManager.tsx',
  'src/components/Inventory/InventoryModuleView.tsx',
  'src/components/Inventory/ProductModal.tsx',
  'src/components/Purchases/PurchasesManager.tsx',
  'src/components/Sales/CreateCreditNoteModal.tsx',
  'src/components/Sales/CreateOrderModal.tsx',
  'src/components/Settings/SettingsManager.tsx',
  'src/components/Suppliers/SuppliersManager.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  if (content.includes('<select')) {
    // Replace <select with <Select
    content = content.replace(/<select/g, '<Select');
    content = content.replace(/<\/select>/g, '</Select>');
    
    // Add import statement if not exists
    if (!content.includes('import { Select }')) {
      // Find relative path to src/components/Shared/Select
      const dir = path.dirname(file);
      const relative = path.relative(dir, 'src/components/Shared/Select');
      const importPath = relative.replace(/\\/g, '/');
      
      const importStmt = `import { Select } from '${importPath.startsWith('.') ? importPath : './' + importPath}';\n`;
      
      // insert after last import
      const lastImportIndex = content.lastIndexOf('import ');
      if (lastImportIndex !== -1) {
        const nextLineIndex = content.indexOf('\n', lastImportIndex);
        content = content.slice(0, nextLineIndex + 1) + importStmt + content.slice(nextLineIndex + 1);
      } else {
        content = importStmt + content;
      }
    }
    
    fs.writeFileSync(file, content);
    console.log(`Patched ${file}`);
  }
}
