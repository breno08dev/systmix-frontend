// src/components/PDV/Comprovante.tsx
import React from 'react';
import { Comanda } from '../../types';

interface ComprovanteProps {
  comanda: Comanda;
  taxaServico?: boolean; // Nova prop para saber se cobra 10%
}

export const Comprovante = React.forwardRef<HTMLDivElement, ComprovanteProps>((props, ref) => {
  const { comanda, taxaServico } = props;
  
  // Cálculo local seguro baseado nos itens reais
  const subtotal = comanda.itens?.reduce((acc, item) => acc + (item.quantidade * item.valor_unit), 0) || 0;
  const valorTaxa = taxaServico ? subtotal * 0.10 : 0;
  const totalFinal = subtotal + valorTaxa;

  return (
    <div ref={ref} className="p-4 font-mono text-xs text-black bg-white">
      <div className="text-center mb-4">
        <h1 className="text-base font-bold">Systmix - Sistema de Bares</h1>
        <p>Comprovante de Consumo - Não Fiscal</p>
      </div>
      
      <div className="mb-2 text-xs">
        <p><span className="font-bold">Comanda:</span> #{comanda.numero}</p>
        <p><span className="font-bold">Cliente:</span> {comanda.cliente?.nome || 'Consumidor Final'}</p>
        <p><span className="font-bold">Data:</span> {new Date().toLocaleString('pt-BR')}</p>
      </div>
      
      <hr className="border-t border-dashed border-black my-2" />
      
      <table className="w-full mb-2">
        <thead>
          <tr>
            <th className="text-left font-bold pb-1">Item</th>
            <th className="text-center font-bold pb-1">Qtd</th>
            <th className="text-right font-bold pb-1">Valor</th>
          </tr>
        </thead>
        <tbody>
          {comanda.itens?.map(item => (
            <tr key={item.id}>
              <td className="text-left py-0.5">{item.produto?.nome}</td>
              <td className="text-center py-0.5">{item.quantidade}</td>
              <td className="text-right py-0.5">
                {(item.quantidade * item.valor_unit).toFixed(2).replace('.', ',')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <hr className="border-t border-dashed border-black my-2" />
      
      <div className="space-y-1">
        {taxaServico && (
          <>
             <div className="flex justify-between text-xs">
                <span>Subtotal:</span>
                <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
            </div>
            <div className="flex justify-between text-xs">
                <span>Serviço (10%):</span>
                <span>R$ {valorTaxa.toFixed(2).replace('.', ',')}</span>
            </div>
          </>
        )}
        
        <div className="flex justify-between font-bold text-sm mt-1">
            <span>TOTAL A PAGAR:</span>
            <span>R$ {totalFinal.toFixed(2).replace('.', ',')}</span>
        </div>
      </div>
      
      <div className="text-center mt-6 text-[10px]">
        <p>Obrigado pela preferência!</p>
        <p>Volte sempre.</p>
      </div>
    </div>
  );
});