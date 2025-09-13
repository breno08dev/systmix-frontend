import React from 'react';
import { Comanda } from '../../types';

interface ComprovanteProps {
  comanda: Comanda;
}

// Usamos React.forwardRef para que o componente pai (ComandaModal) possa obter
// uma referência direta ao elemento <div>, o que é um requisito da biblioteca react-to-print.
export const Comprovante = React.forwardRef<HTMLDivElement, ComprovanteProps>((props, ref) => {
  const { comanda } = props;
  const total = comanda.itens?.reduce((acc, item) => acc + (item.quantidade * item.valor_unit), 0) || 0;

  return (
    // A 'ref' é anexada a este <div>, que é o container que será impresso.
    <div ref={ref} className="p-4 font-mono text-xs text-black">
      <div className="text-center mb-4">
        <h1 className="text-base font-bold">NextSys - Sistema de Gerenciamento de Bares</h1>
        <p>Comprovante de Consumo - Não Fiscal</p>
      </div>
      <div className="mb-2">
        <p><span className="font-bold">Comanda:</span> {comanda.numero}</p>
        <p><span className="font-bold">Cliente:</span> {comanda.cliente?.nome || 'Não informado'}</p>
        <p><span className="font-bold">Abertura:</span> {new Date(comanda.criado_em).toLocaleString('pt-BR')}</p>
      </div>
      <hr className="border-t border-dashed border-black my-2" />
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left font-bold">Item</th>
            <th className="text-center font-bold">Qtd</th>
            <th className="text-right font-bold">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {comanda.itens?.map(item => (
            <tr key={item.id}>
              <td className="text-left">{item.produto?.nome}</td>
              <td className="text-center">{item.quantidade}</td>
              <td className="text-right">R$ {(item.quantidade * item.valor_unit).toFixed(2).replace('.', ',')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <hr className="border-t border-dashed border-black my-2" />
      <div className="flex justify-between font-bold text-sm mt-2">
        <span>TOTAL:</span>
        <span>R$ {total.toFixed(2).replace('.', ',')}</span>
      </div>
    </div>
  );
});