const fs = require('fs');
const path = require('path');

const file = 'c:/Users/chezd/Documents/GitHub/Djeli-S-Stock/lib/db/business_backup.ts';
const actionsDir = 'c:/Users/chezd/Documents/GitHub/Djeli-S-Stock/lib/db/actions';
if (!fs.existsSync(actionsDir)) fs.mkdirSync(actionsDir);

const content = fs.readFileSync(file, 'utf-8');

const commonImports = '"use server";\\n' +
'import { createServerClient } from "@supabase/ssr";\\n' +
'import { createClient as createSupabaseClient } from "@supabase/supabase-js";\\n' +
'import { cookies } from "next/headers";\\n' +
'import type { Database } from "../../types/database.types";\\n' +
'import { z } from "zod";\\n\\n';

const actionImports = commonImports + 'import { getAdmin, getOrCreateUserOrg } from "./auth";\\n\\n';

const extractFunction = (text, funcName, isExported = true) => {
    let lines = text.split('\\n');
    let inside = false;
    let result = [];
    let indentLevel = 0;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (!inside && (line.includes('function ' + funcName + '(') || line.includes('function ' + funcName + ' ('))) {
            inside = true;
        }
        if (inside) {
            result.push(line);
            if (line.includes('{')) indentLevel += (line.match(/\\{/g) || []).length;
            if (line.includes('}')) indentLevel -= (line.match(/\\}/g) || []).length;
            if (indentLevel === 0) break;
        }
    }
    
    let joined = result.join('\\n') + '\\n';
    if (!isExported) {
       joined = joined.replace('async function', 'export async function').replace(/^function/m, 'export function');
    }
    return joined;
}

const extractZodSchema = (text, schemaName) => {
    let lines = text.split('\\n');
    let inside = false;
    let result = [];
    let indentLevel = 0;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (!inside && line.includes('const ' + schemaName + ' = z.object({')) {
            inside = true;
        }
        if (inside) {
            result.push(line);
            if (line.includes('{')) indentLevel += (line.match(/\\{/g) || []).length;
            if (line.includes('}')) indentLevel -= (line.match(/\\}/g) || []).length;
            if (indentLevel === 0 && line.includes(';')) break;
        }
    }
    return result.length ? result.join('\\n') + '\\n' : '';
}

const authCode = commonImports + 
    extractFunction(content, 'createClient') + "\\n" +
    extractFunction(content, 'getAdmin', false) + "\\n" +
    extractFunction(content, 'getOrCreateUserOrg', false);
fs.writeFileSync(path.join(actionsDir, 'auth.ts'), authCode);

const salesCode = actionImports + 
    extractZodSchema(content, 'SaleItemSchema') + "\\n" +
    extractZodSchema(content, 'ProcessSaleSchema') + "\\n" +
    extractFunction(content, 'processSale') + "\\n" +
    extractFunction(content, 'payReceivable');
fs.writeFileSync(path.join(actionsDir, 'sales.ts'), salesCode);

const customersCode = actionImports + extractFunction(content, 'createCustomer');
fs.writeFileSync(path.join(actionsDir, 'customers.ts'), customersCode);

const suppliersCode = actionImports + 
    extractFunction(content, 'createSupplier') + "\\n" +
    extractFunction(content, 'paySupplier');
fs.writeFileSync(path.join(actionsDir, 'suppliers.ts'), suppliersCode);

const storesCode = actionImports + 
    extractFunction(content, 'createStore') + "\\n" +
    extractFunction(content, 'createClientWorkspace') + "\\n" +
    extractFunction(content, 'createEmployee');
fs.writeFileSync(path.join(actionsDir, 'stores.ts'), storesCode);

const productsCode = actionImports + 
    extractFunction(content, 'createProduct') + "\\n" +
    extractFunction(content, 'addStockMovement');
fs.writeFileSync(path.join(actionsDir, 'products.ts'), productsCode);

const barrelCode = "export * from './actions/auth';\\n" +
"export * from './actions/sales';\\n" +
"export * from './actions/customers';\\n" +
"export * from './actions/suppliers';\\n" +
"export * from './actions/stores';\\n" +
"export * from './actions/products';\\n";
fs.writeFileSync('c:/Users/chezd/Documents/GitHub/Djeli-S-Stock/lib/db/business.ts', barrelCode);

console.log("Splitting completed successfully.");
