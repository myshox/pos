import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const CHART_COLORS = ['#b8860b', '#8b6914', '#c99a1a', '#5c4a3a', '#7d6b5a', '#9a7518', '#a68b5c', '#6b5344'];

export default function CategoryRevenueChart({ byCategory, totalRevenue }) {
  if (!byCategory?.length || totalRevenue <= 0) return null;

  const data = byCategory.map((row, i) => ({
    name: row.category,
    value: row.revenue,
    percent: ((row.revenue / totalRevenue) * 100).toFixed(1),
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div className="w-full max-w-md mx-auto">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="50%"
            outerRadius="80%"
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name, props) => [
              `NT$ ${Number(value).toLocaleString()}（${props.payload?.percent ?? 0}%）`,
              name,
            ]}
            contentStyle={{ borderRadius: '12px', border: '1px solid #e8e2d9' }}
            labelFormatter={(name) => name}
          />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            formatter={(value) => {
              const item = data.find((d) => d.name === value);
              return `${value} ${item?.percent ?? 0}%`;
            }}
            wrapperStyle={{ fontSize: '13px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
