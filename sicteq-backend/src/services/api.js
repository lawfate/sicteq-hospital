const API_URL = 'http://localhost:4000';

export const getAreas = async () => {
    try {
        const response = await fetch(`${API_URL}/api/areas`);
        if (!response.ok) throw new Error('Error al conectar con el servidor');
        return await response.json();
    } catch (error) {
        console.error("Error en getAreas:", error);
        return [];
    }
};