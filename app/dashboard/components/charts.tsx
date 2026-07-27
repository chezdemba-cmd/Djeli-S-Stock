import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

export const salesData = [
  { date: '11 Juil', ventes: 450000 },
  { date: '12 Juil', ventes: 520000 },
  { date: '13 Juil', ventes: 380000 },
  { date: '14 Juil', ventes: 610000 },
  { date: '15 Juil', ventes: 590000 },
  { date: '16 Juil', ventes: 720000 },
  { date: '17 Juil', ventes: 850000 },
];

export const stockData = [
  { name: 'Céréales', value: 5148000, color: '#173f35' },
  { name: 'Huiles', value: 609000, color: '#246452' },
  { name: 'Boissons', value: 340000, color: '#d7a83f' },
  { name: 'Autres', value: 120000, color: '#e7e8e3' },
];

export function Charts({ money }: { money: Intl.NumberFormat }) {
  return (
    <section className="charts-grid">
      <div className="chart-card">
        <h3>Évolution du Chiffre d'Affaires (7 derniers jours)</h3>
        <div style={{ width: '100%', height: 250 }}>
          <ResponsiveContainer>
            <AreaChart data={salesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorVentes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#173f35" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#173f35" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#888' }} dy={10} />
              <YAxis tickFormatter={(val) => `${val/1000}k`} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#888' }} />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Tooltip formatter={(value: any) => money.format(Number(value))} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Area type="monotone" dataKey="ventes" stroke="#173f35" strokeWidth={3} fillOpacity={1} fill="url(#colorVentes)" activeDot={{ r: 6, strokeWidth: 0, fill: '#d7a83f' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card">
        <h3>Répartition de la valeur du Stock</h3>
        <div style={{ width: '100%', height: 250 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={stockData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                {stockData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
              </Pie>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Tooltip formatter={(value: any) => money.format(Number(value))} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
