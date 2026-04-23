import React, { useEffect, useState } from 'react';
import { logsService } from '../../services/logs';
import { LogSistema } from '../../types';
import { History, ChevronLeft, ChevronRight, User, Loader2 } from 'lucide-react';

export const LogsSistema: React.FC = () => {
  const [logs, setLogs] = useState<LogSistema[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    carregarLogs();
  }, [pagina]);

  const carregarLogs = async () => {
    setCarregando(true);
    try {
      const { data, count } = await logsService.listar(pagina, pageSize);
      setLogs(data);
      setTotal(count);
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  };

  const totalPaginas = Math.ceil(total / pageSize);

  return (
    // w-full e flex-1 garantem que a tela preencha todo o espaço disponível do monitor
    <div className="p-4 md:p-8 w-full h-full flex flex-col gap-6">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-600/20">
            <History size={24} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Logs de Auditoria</h1>
            <p className="text-slate-500 text-sm">Registro de ações críticas e autorizações do sistema.</p>
          </div>
        </div>
      </div>

      {/* CONTAINER DA TABELA - Preenche o restante da tela */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
        
        {/* ÁREA COM SCROLL - Apenas a tabela rola, a paginação fica fixa embaixo */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse whitespace-nowrap min-w-[800px]">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-4">Data / Hora</th>
                <th className="px-6 py-4">Usuário</th>
                <th className="px-6 py-4">Ação</th>
                <th className="px-6 py-4 w-full">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {carregando ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-400">
                    <Loader2 size={32} className="animate-spin mx-auto mb-3 text-indigo-500" />
                    Buscando registros de auditoria...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-400">Nenhum log registrado até o momento.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(log.criado_em).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                          <User size={14} />
                        </div>
                        <span className="text-sm font-medium text-slate-900">{log.usuario_nome}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        log.acao.includes('EXCLUIR') || log.acao.includes('REMOVER') 
                          ? 'bg-rose-100 text-rose-600' 
                          : 'bg-blue-100 text-blue-600'
                      }`}>
                        {log.acao.replace(/_/g, ' ')}
                      </span>
                    </td>
                    {/* Truncate para não estourar a tela se o texto for gigante */}
                    <td className="px-6 py-4 text-sm text-slate-500 truncate max-w-[200px] sm:max-w-md lg:max-w-2xl xl:max-w-4xl" title={log.detalhes}>
                      {log.detalhes}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* CONTROLES DE PAGINAÇÃO - Fixos no rodapé do container */}
        <div className="p-4 bg-slate-50 flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 gap-4 mt-auto">
          <p className="text-sm text-slate-500">
            Total de <span className="font-bold text-slate-700">{total}</span> registros gravados
          </p>
          
          <div className="flex items-center gap-2">
            <button 
              disabled={pagina === 1 || carregando}
              onClick={() => setPagina(p => p - 1)}
              className="p-2 border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-100 hover:text-indigo-600 disabled:opacity-50 disabled:hover:bg-white transition-all shadow-sm"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="flex items-center px-4 text-sm font-medium text-slate-700">
              Página {pagina} de {totalPaginas || 1}
            </span>
            <button 
              disabled={pagina >= totalPaginas || carregando}
              onClick={() => setPagina(p => p + 1)}
              className="p-2 border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-100 hover:text-indigo-600 disabled:opacity-50 disabled:hover:bg-white transition-all shadow-sm"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};