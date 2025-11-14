// electron/preload.ts (VERSÃO FINAL DE VERIFICAÇÃO)
const { contextBridge, ipcRenderer } = require('electron');



// Expor a API do banco de dados local
contextBridge.exposeInMainWorld('localApi', {
  // Clientes
  getClientes: () => ipcRenderer.invoke('sqlite:get-clientes'),
  createCliente: (cliente: any) => ipcRenderer.invoke('sqlite:create-cliente', cliente),
  updateCliente: (id: string, cliente: any) => ipcRenderer.invoke('sqlite:update-cliente', id, cliente),
  deleteCliente: (id: string) => ipcRenderer.invoke('sqlite:delete-cliente', id),

  // Produtos
  getProdutos: () => ipcRenderer.invoke('sqlite:get-produtos'),
  createProduto: (produto: any) => ipcRenderer.invoke('sqlite:create-produto', produto),
  updateProduto: (id: string, produto: any) => ipcRenderer.invoke('sqlite:update-produto', id, produto),
  deleteProduto: (id: string) => ipcRenderer.invoke('sqlite:delete-produto', id),
  
  // Comandas
  getComandasAbertas: () => ipcRenderer.invoke('sqlite:get-comandas-abertas'),
  createComanda: (comanda: any) => ipcRenderer.invoke('sqlite:create-comanda', comanda),
  addItemComanda: (item: any) => ipcRenderer.invoke('sqlite:add-item-comanda', item),
  updateItemQuantidade: (idItem: string, quantidade: number) => ipcRenderer.invoke('sqlite:update-item-quantidade', idItem, quantidade),
  removeItemComanda: (idItem: string) => ipcRenderer.invoke('sqlite:remove-item-comanda', idItem),
  fecharComanda: (idComanda: string, pagamentos: any[]) => ipcRenderer.invoke('sqlite:fechar-comanda', idComanda, pagamentos),

  // Fila de Sincronização
  getPendingActions: () => ipcRenderer.invoke('sqlite:get-pending-actions'),
  addPendingAction: (action: any) => ipcRenderer.invoke('sqlite:add-pending-action', action),
  deletePendingAction: (id: number) => ipcRenderer.invoke('sqlite:delete-pending-action', id),
});