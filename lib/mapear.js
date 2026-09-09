/** Conversão entre as colunas do banco e o formato que o app usa. */

export const veiculoParaApp = (l) => ({
  id: l.id,
  nome: l.nome,
  marca: l.marca || "",
  modelo: l.modelo || "",
  ano: l.ano || "",
  placa: l.placa || "",
  cor: l.cor || "",
  combustivel: l.combustivel || "",
  kmAtual: Number(l.km_atual) || 0,
  kmInicial: l.km_inicial == null ? null : Number(l.km_inicial),
  createdAt: Number(l.criado_em) || 0
});

export const manutencaoParaApp = (l) => ({
  id: l.id,
  vehicleId: l.vehicle_id,
  data: l.data,
  km: Number(l.km) || 0,
  categoria: l.categoria,
  servico: l.servico,
  peca: l.peca || "",
  marcaPeca: l.marca_peca || "",
  valorPeca: Number(l.valor_peca) || 0,
  valorMaoObra: Number(l.valor_mao_obra) || 0,
  valorTotal: Number(l.valor_total) || 0,
  executadoPor: l.executado_por || "",
  proximaKm: l.proxima_km == null ? null : Number(l.proxima_km),
  proximaData: l.proxima_data || null,
  comprovante: l.comprovante || "",
  observacoes: l.observacoes || "",
  temFoto: !!l.foto_url,
  createdAt: Number(l.criado_em) || 0,
  updatedAt: Number(l.atualizado_em) || 0
});
