"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("localApi", {
  getClientes: () => electron.ipcRenderer.invoke("sqlite:get-clientes"),
  createCliente: (cliente) => electron.ipcRenderer.invoke("sqlite:create-cliente", cliente),
  updateCliente: (id, cliente) => electron.ipcRenderer.invoke("sqlite:update-cliente", id, cliente),
  deleteCliente: (id) => electron.ipcRenderer.invoke("sqlite:delete-cliente", id),
  getProdutos: () => electron.ipcRenderer.invoke("sqlite:get-produtos"),
  createProduto: (produto) => electron.ipcRenderer.invoke("sqlite:create-produto", produto),
  updateProduto: (id, produto) => electron.ipcRenderer.invoke("sqlite:update-produto", id, produto),
  deleteProduto: (id) => electron.ipcRenderer.invoke("sqlite:delete-produto", id),
  getComandasAbertas: () => electron.ipcRenderer.invoke("sqlite:get-comandas-abertas"),
  createComanda: (comanda) => electron.ipcRenderer.invoke("sqlite:create-comanda", comanda),
  addItemComanda: (item) => electron.ipcRenderer.invoke("sqlite:add-item-comanda", item),
  updateItemQuantidade: (idItem, quantidade) => electron.ipcRenderer.invoke("sqlite:update-item-quantidade", idItem, quantidade),
  removeItemComanda: (idItem) => electron.ipcRenderer.invoke("sqlite:remove-item-comanda", idItem),
  fecharComanda: (idComanda, pagamentos) => electron.ipcRenderer.invoke("sqlite:fechar-comanda", idComanda, pagamentos),
  getPendingActions: () => electron.ipcRenderer.invoke("sqlite:get-pending-actions"),
  addPendingAction: (action) => electron.ipcRenderer.invoke("sqlite:add-pending-action", action),
  deletePendingAction: (id) => electron.ipcRenderer.invoke("sqlite:delete-pending-action", id)
});
