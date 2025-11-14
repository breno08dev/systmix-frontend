// electron/database.ts (VERSÃO FINAL CORRIGIDA)
import knex, { Knex } from 'knex';
import path from 'path';
import { app } from 'electron';

const dbPath = path.join(app.getPath('userData'), 'systmix.offline.sqlite');

export const db: Knex = knex({
  client: 'better-sqlite3',
  connection: {
    filename: dbPath,
  },
  useNullAsDefault: true,
});

// Função para criar o schema (MODO CORRIGIDO)
export async function initDatabase() {
  
  if (!(await db.schema.hasTable('produtos'))) {
    await db.schema.createTable('produtos', (table) => {
      table.uuid('id').primary();
      table.text('nome').notNullable();
      table.text('categoria').notNullable();
      table.decimal('preco').notNullable().defaultTo(0);
      table.boolean('ativo').defaultTo(true);
      table.timestamp('criado_em').defaultTo(db.fn.now()); // <--- CORRIGIDO
    });
  }

  if (!(await db.schema.hasTable('clientes'))) {
    await db.schema.createTable('clientes', (table) => {
      table.uuid('id').primary();
      table.text('nome').notNullable();
      table.text('telefone');
      table.timestamp('criado_em').defaultTo(db.fn.now()); // <--- CORRIGIDO
    });
  }

  if (!(await db.schema.hasTable('comandas'))) {
    await db.schema.createTable('comandas', (table) => {
      table.uuid('id').primary();
      table.integer('numero').notNullable();
      table.uuid('id_cliente').references('id').inTable('clientes');
      table.string('status', 10).notNullable().defaultTo('aberta');
      table.timestamp('criado_em').defaultTo(db.fn.now()); // <--- CORRIGIDO
      table.timestamp('fechado_em');
    });
  }
  
  if (!(await db.schema.hasTable('itens_comanda'))) {
    await db.schema.createTable('itens_comanda', (table) => {
      table.uuid('id').primary();
      table.uuid('id_comanda').references('id').inTable('comandas').onDelete('CASCADE');
      table.uuid('id_produto').references('id').inTable('produtos');
      table.integer('quantidade').notNullable().defaultTo(1);
      table.decimal('valor_unit').notNullable().defaultTo(0);
      table.timestamp('criado_em').defaultTo(db.fn.now()); // <--- CORRIGIDO
    });
  }

  if (!(await db.schema.hasTable('pagamentos'))) {
    await db.schema.createTable('pagamentos', (table) => {
      table.uuid('id').primary();
      table.uuid('id_comanda').references('id').inTable('comandas').onDelete('CASCADE');
      table.text('metodo').notNullable();
      table.decimal('valor').notNullable().defaultTo(0);
      table.timestamp('data').defaultTo(db.fn.now()); // <--- CORRIGIDO
    });
  }

  if (!(await db.schema.hasTable('pending_actions'))) {
    await db.schema.createTable('pending_actions', (table) => {
      table.increments('id').primary();
      table.string('action_type', 50).notNullable(); 
      table.json('payload').notNullable();
      table.timestamp('criado_em').defaultTo(db.fn.now()); // <--- CORRIGIDO
    });
  }

  console.log('Banco de dados local (better-sqlite3) inicializado em:', dbPath);
}