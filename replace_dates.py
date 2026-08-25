import re
import os
import glob

def replace_in_file(filepath, import_path):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'CustomDatePicker' not in content:
        # Add import CustomDatePicker right after the first import or another shared component import
        if 'import { Select } from' in content:
            content = content.replace('import { Select } from', f'import {{ CustomDatePicker }} from \'{import_path}\';\nimport {{ Select }} from')
        elif 'import { CustomSelect } from' in content:
            content = content.replace('import { CustomSelect } from', f'import {{ CustomDatePicker }} from \'{import_path}\';\nimport {{ CustomSelect }} from')
        else:
            # just append after first import
            content = re.sub(r'(import .*?;)', r'\1\nimport { CustomDatePicker } from \'' + import_path + '\';', content, count=1)

    # replace input type="date"
    # We look for <input ... type="date" ... />
    # Example format:
    # <input
    #   type="date"
    #   value={startDate}
    #   onChange={(e) => setStartDate(e.target.value)}
    #   className="..."
    # />
    
    pattern = re.compile(
        r'<input\s+([^>]*?)type="date"([^>]*?)value={([^}]+)}\s+onChange={\(e\) => set([a-zA-Z0-9_]+)\(e\.target\.value\)}([^>]*?)(?:/>|>\s*</input>)',
        re.DOTALL
    )
    
    def repl(m):
        before = m.group(1)
        after1 = m.group(2)
        val = m.group(3)
        setter = m.group(4)
        after2 = m.group(5)
        
        # reconstruct attributes, removing required since custom component doesn't use it or we just pass it
        all_attrs = (before + after1 + after2)
        # keep className
        class_match = re.search(r'className=({[^}]+}|"[^"]+")', all_attrs)
        class_str = class_match.group(0) if class_match else 'className="w-full"'
        
        return f'<CustomDatePicker value={{{val}}} onChange={{set{setter}}} {class_str} />'
        
    new_content = pattern.sub(repl, content)
    
    # Second pattern for object setters like setFormData({ ...formData, issueDate: e.target.value })
    pattern2 = re.compile(
        r'<input\s+([^>]*?)type="date"([^>]*?)value={([^}]+)}\s+onChange={\(e\) => set([a-zA-Z0-9_]+)\({ \.\.\.([a-zA-Z0-9_]+), ([a-zA-Z0-9_]+): e\.target\.value }\)}([^>]*?)(?:/>|>\s*</input>)',
        re.DOTALL
    )
    
    def repl2(m):
        before = m.group(1)
        after1 = m.group(2)
        val = m.group(3)
        setter = m.group(4)
        state_var = m.group(5)
        prop = m.group(6)
        after2 = m.group(7)
        
        all_attrs = (before + after1 + after2)
        class_match = re.search(r'className=({[^}]+}|"[^"]+")', all_attrs)
        class_str = class_match.group(0) if class_match else 'className="w-full"'
        
        return f'<CustomDatePicker value={{{val}}} onChange={{(val) => set{setter}({{ ...{state_var}, {prop}: val }})}} {class_str} />'

    new_content = pattern2.sub(repl2, new_content)
    
    if content != new_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

replace_in_file('src/components/Sales/CreateMedicalPrescriptionModal.tsx', '../Shared/CustomDatePicker')
replace_in_file('src/components/Sales/CreateGuiaRemisionModal.tsx', '../Shared/CustomDatePicker')
replace_in_file('src/components/Reports/ReportsManager.tsx', '../Shared/CustomDatePicker')
replace_in_file('src/components/Purchases/PurchasesManager.tsx', '../Shared/CustomDatePicker')
replace_in_file('src/components/HR/HRManager.tsx', '../Shared/CustomDatePicker')

