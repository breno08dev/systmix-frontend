// src/components/PDV/PDV.tsx
import React, { useState, useEffect } from 'react';
import { ShoppingCart, Wifi, WifiOff, Search, PlusCircle, Clock, ChevronRight } from 'lucide-react';
import { comandasService } from '../../services/comandas';
import { produtosService } from '../../services/produtos';
import { clientesService } from '../../services/clientes';
import { Comanda, Produto, Cliente } from '../../types';
import ComandaModal from './ComandaModal'; 
import { AbrirComandaModal } from './AbrirComandaModal';
import { useToast } from '../../contexts/ToastContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useSync } from '../../contexts/SyncContext';

const formatTimeSafe = (dateString: string) => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
};

export const PDV: React.FC = () => {
  const [comandasAbertas, setComandasAbertas] = useState<Comanda[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  
  const [comandaSelecionada, setComandaSelecionada] = useState<Comanda | null>(null);
  const [numeroParaAbrir, setNumeroParaAbrir] = useState<number | null>(null);
  
  const [filtroNumero, setFiltroNumero] = useState('');

  const { addToast } = useToast();
  const { isOnline } = useOnlineStatus();
  const { isSyncing } = useSync();

  useEffect(() => {
    carregarDados();
  }, [isOnline, isSyncing]); 

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [comandasData, produtosData, clientesData] = await Promise.all([
        comandasService.listarAbertas(isOnline),
        produtosService.listarAtivos(isOnline),
        clientesService.listar(isOnline)
      ]);
      setComandasAbertas(comandasData);
      setProdutos(produtosData);
      setClientes(clientesData);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      addToast(error.message || 'Erro ao carregar dados do PDV', 'error');
    } finally {
      setCarregando(false);
    }
  };

  const handleAbrirOuEditarComanda = (numero: number) => {
    const comandaExistente = comandasAbertas.find(c => c.numero === numero);
    if (comandaExistente) {
      setComandaSelecionada(comandaExistente);
    } else {
      setNumeroParaAbrir(numero);
    }
  };

  const handleConfirmarAbertura = async (numero: number, idCliente?: string, clientObject?: Cliente) => {
    try {
      const novaComanda = await comandasService.criarComanda(isOnline, numero, idCliente);
      addToast(`Comanda ${numero} aberta com sucesso!`, 'success');
      setNumeroParaAbrir(null);
      
      const comandaComCliente = { 
        ...novaComanda, 
        cliente: clientObject || novaComanda.cliente 
      };
      
      // Abre o modal diretamente
      setComandaSelecionada(comandaComCliente);
      
      // Atualiza lista em background
      carregarDados(); 
    } catch (error: any) {
      addToast(error.message || 'Erro ao abrir comanda.', 'error');
    }
  };

  const handleFecharModal = (idComandaFechada?: string) => {
    setComandaSelecionada(null);
    // ATENÇÃO: Recarrega sempre para garantir que os totais e status na lista estejam corretos
    carregarDados();
  };
  
  const handleItemAtualizado = () => {
     // Função opcional, pois o carregarDados no close já resolve.
     // Se quiser atualizar a lista em tempo real enquanto o modal está aberto, chame carregarDados() aqui.
  };
  
  const calcularTotalComanda = (comanda: Comanda) => {
    return comanda.itens?.reduce((total, item) => 
      total + (item.quantidade * item.valor_unit), 0
    ) || 0;
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto min-h-screen flex flex-col gap-8">
      
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Ponto de Venda</h1>
          <p className="text-slate-500">Gerencie comandas e pedidos em tempo real.</p>
        </div>
        
        <div className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 border transition-colors ${
            isOnline ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'
        }`}>
            {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
            {isOnline ? 'Sistema Online' : 'Modo Offline Ativo'}
        </div>
      </div>

      {/* Seção de Comandas Abertas */}
      <section>
        <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <div className="w-2 h-6 bg-indigo-600 rounded-full"></div>
                Comandas Abertas
                <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {comandasAbertas.length} ativas
                </span>
            </h2>
        </div>

        {carregando && comandasAbertas.length === 0 ? (
            <div className="h-40 flex items-center justify-center bg-white rounded-2xl border border-slate-100 border-dashed">
                <p className="text-slate-400 animate-pulse">Carregando comandas...</p>
            </div>
        ) : comandasAbertas.length === 0 ? (
            <div className="p-8 bg-white rounded-2xl border border-slate-100 text-center shadow-sm">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                    <ShoppingCart size={32} />
                </div>
                <p className="text-slate-500">Nenhuma comanda aberta no momento.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {comandasAbertas.map(comanda => (
                <div
                  key={comanda.id}
                  onClick={() => handleAbrirOuEditarComanda(comanda.numero)}
                  className="group bg-white border border-slate-200 rounded-2xl p-5 cursor-pointer hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="text-indigo-400" />
                  </div>

                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-md group-hover:bg-indigo-600 transition-colors">
                        {comanda.numero}
                    </div>
                  </div>
                  
                  <div>
                    <p className="font-bold text-slate-900 truncate text-lg mb-1 group-hover:text-indigo-700 transition-colors">
                        {comanda.cliente?.nome || 'Consumidor Final'}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mb-3">
                        <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {formatTimeSafe(comanda.criado_em)}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span>{comanda.itens?.length || 0} itens</span>
                    </div>
                    
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-semibold uppercase">Total</span>
                        <span className="text-xl font-black text-emerald-600">
                            R$ {calcularTotalComanda(comanda).toFixed(2).replace('.', ',')}
                        </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
        )}
      </section>

      {/* Grade de Seleção Rápida */}
      <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <PlusCircle className="text-indigo-600" />
            Mapa de Mesas / Comandas
          </h2>
          
          <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
             <input 
                type="text" 
                placeholder="Buscar número..." 
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 w-full md:w-64"
                value={filtroNumero}
                onChange={(e) => setFiltroNumero(e.target.value)}
             />
          </div>
        </div>
        
        <div className="p-6 bg-slate-50/50">
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-3">
            {Array.from({ length: 100 }, (_, i) => i + 1)
                .filter(n => !filtroNumero || n.toString().includes(filtroNumero))
                .map(numero => {
              const comandaExistente = comandasAbertas.find(c => c.numero === numero);
              const isOccupied = !!comandaExistente;
              
              return (
                <button
                  key={numero}
                  onClick={() => handleAbrirOuEditarComanda(numero)}
                  className={`
                    aspect-square rounded-xl font-bold text-sm transition-all duration-200 flex flex-col items-center justify-center gap-1 shadow-sm border
                    ${isOccupied 
                        ? 'bg-white border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 shadow-rose-100' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 hover:shadow-indigo-100'
                    }
                  `}
                  title={isOccupied ? `Comanda ${numero} - Em uso por ${comandaExistente.cliente?.nome || 'Cliente'}` : `Abrir comanda ${numero}`}
                >
                    <span className="text-lg">{numero}</span>
                    {isOccupied && <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Modais */}
      {numeroParaAbrir && (
        <AbrirComandaModal
          numeroComanda={numeroParaAbrir}
          clientes={clientes}
          onClose={() => setNumeroParaAbrir(null)}
          onComandaAberta={handleConfirmarAbertura}
          isOnline={isOnline}
        />
      )}

      {comandaSelecionada && (
        <ComandaModal
          comandaInicial={comandaSelecionada}
          produtos={produtos}
          onClose={handleFecharModal} 
          onItemUpdated={handleItemAtualizado}
          isOnline={isOnline}
        />
      )}
    </div>
  );
};