const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("localApi", {
  // Clientes
  getClientes: () => ipcRenderer.invoke("sqlite:get-clientes"),
  createCliente: (cliente) => ipcRenderer.invoke("sqlite:create-cliente", cliente),
  updateCliente: (id, cliente) => ipcRenderer.invoke("sqlite:update-cliente", id, cliente),
  deleteCliente: (id) => ipcRenderer.invoke("sqlite:delete-cliente", id),
  // Produtos
  getProdutos: () => ipcRenderer.invoke("sqlite:get-produtos"),
  createProduto: (produto) => ipcRenderer.invoke("sqlite:create-produto", produto),
  updateProduto: (id, produto) => ipcRenderer.invoke("sqlite:update-produto", id, produto),
  deleteProduto: (id) => ipcRenderer.invoke("sqlite:delete-produto", id),
  // Comandas
  getComandasAbertas: () => ipcRenderer.invoke("sqlite:get-comandas-abertas"),
  createComanda: (comanda) => ipcRenderer.invoke("sqlite:create-comanda", comanda),
  addItemComanda: (item) => ipcRenderer.invoke("sqlite:add-item-comanda", item),
  updateItemQuantidade: (idItem, quantidade) => ipcRenderer.invoke("sqlite:update-item-quantidade", idItem, quantidade),
  removeItemComanda: (idItem) => ipcRenderer.invoke("sqlite:remove-item-comanda", idItem),
  fecharComanda: (idComanda, pagamentos) => ipcRenderer.invoke("sqlite:fechar-comanda", idComanda, pagamentos),
  // Fila de Sincronização
  getPendingActions: () => ipcRenderer.invoke("sqlite:get-pending-actions"),
  addPendingAction: (action) => ipcRenderer.invoke("sqlite:add-pending-action", action),
  deletePendingAction: (id) => ipcRenderer.invoke("sqlite:delete-pending-action", id)
});
