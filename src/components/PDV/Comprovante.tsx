// src/components/PDV/Comprovante.tsx
import React from 'react';
import { Comanda } from '../../types';

interface ComprovanteProps {
  comanda: Comanda;
  taxaServico?: boolean; // Nova prop para saber se cobra 10%
}

export const Comprovante = React.forwardRef<HTMLDivElement, ComprovanteProps>((props, ref) => {
  const { comanda, taxaServico } = props;
  
  // Função para formatar moeda corretamente (R$ 0,00)
  const f = (valor: number) => {
    return valor.toLocaleString('pt-BR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  // Cálculo local seguro baseado nos itens reais
  const subtotal = comanda.itens?.reduce((acc, item) => acc + (item.quantidade * item.valor_unit), 0) || 0;
  const valorTaxa = taxaServico ? subtotal * 0.10 : 0;
  const totalFinal = subtotal + valorTaxa;

  return (
    <div ref={ref} className="p-2 font-mono text-sm text-black bg-white font-bold w-full max-w-[300px] mx-auto">
      
      {/* ESTA TAG STYLE GARANTE QUE A IMPRESSORA VAI FORÇAR NEGRITO EM TUDO, SEM EXCEÇÃO */}
      <style dangerouslySetInnerHTML={{__html: `
        * { font-weight: bold !important; }
      `}} />

      <div className="text-center mb-5">
        <h1 className="text-base uppercase font-bold">Ce Ta Doido Dos Homins</h1>
        <p className="text-xs font-bold mt-1">Comprovante de Consumo - Não Fiscal</p>
      </div>
      
      <div className="mb-3 space-y-1 text-xs font-bold">
        <p className="font-bold">Comanda: #{comanda.numero}</p>
        <p className="font-bold">Cliente: {comanda.cliente?.nome || 'Consumidor Final'}</p>
        <p className="font-bold">Data: {new Date().toLocaleString('pt-BR')}</p>
      </div>
      
      <hr className="border-t-2 border-dashed border-black my-2" />
      
      <table className="w-full mb-2 text-xs font-bold">
        <thead>
          <tr>
            <th className="text-left font-bold pb-2">Item</th>
            <th className="text-center font-bold pb-2 px-1">Qtd</th>
            <th className="text-right font-bold pb-2">Valor</th>
          </tr>
        </thead>
        <tbody>
          {comanda.itens?.map(item => (
            <tr key={item.id}>
              <td className="text-left py-1 font-bold">{item.produto?.nome}</td>
              <td className="text-center py-1 font-bold">{item.quantidade}</td>
              <td className="text-right py-1 font-bold">
                {f(item.quantidade * item.valor_unit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <hr className="border-t-2 border-dashed border-black my-2" />
      
      <div className="space-y-1 mt-2 text-sm font-bold">
        {taxaServico && (
          <>
             <div className="flex justify-between font-bold">
                <span className="font-bold">Subtotal:</span>
                <span className="font-bold">R$ {f(subtotal)}</span>
            </div>
            <div className="flex justify-between font-bold">
                <span className="font-bold">Serviço (10%):</span>
                <span className="font-bold">R$ {f(valorTaxa)}</span>
            </div>
          </>
        )}
        
        <div className="flex justify-between text-base uppercase mt-2 pt-2 border-t-2 border-black font-bold">
            <span className="font-bold">TOTAL A PAGAR:</span>
            <span className="font-bold">R$ {f(totalFinal)}</span>
        </div>
      </div>
      
      <div className="text-center mt-6 text-xs space-y-1 font-bold">
        <p className="font-bold">Obrigado pela preferência!</p>
        <p className="font-bold">Volte sempre.</p>
      </div>
    </div>
  );
});