const employees = [{id: 'emp-1', fullName: 'John'}];
const editingEmpId = 'emp-1';
const item = {id: 'emp-1', fullName: 'John Doe', code: 'EMP-01'};
const newEmployees = employees.map(e => e.id === editingEmpId ? { ...item, code: e.code } : e);
console.log(newEmployees);
