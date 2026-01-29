import { useEffect, useState } from 'react';
import axios from 'axios';

type TreeNode = {
  id: string;
  name: string;
  role: string;
  children: TreeNode[];
};
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

const OrganizationTree = () => {
  const [tree, setTree] = useState<TreeNode[]>([]);

  useEffect(() => {
    const fetchTree = async () => {
      try {
        const res = await axios.get(`${API_URL}/teams/hierarchy`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setTree(res.data.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchTree();
  }, []);

  const renderNode = (node: TreeNode, level = 0) => (
    <div key={node.id} style={{ marginLeft: `${level * 24}px` }}>
      <div className="font-medium py-1">
        {node.name} <span className="text-sm text-gray-500">({node.role})</span>
      </div>
      {node.children?.map(child => renderNode(child, level + 1))}
    </div>
  );

  return (
    <div className="border rounded-lg p-6 bg-white">
      {tree.length === 0 ? (
        <p className="text-gray-500">Loading organization structure...</p>
      ) : (
        tree.map(node => renderNode(node))
      )}
    </div>
  );
};

export default OrganizationTree;