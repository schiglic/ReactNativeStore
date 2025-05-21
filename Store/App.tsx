import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import Login from './Login';
import Products from './Products';
import Profile from './Profile';
import Register from './Register';

interface User {
    name: string;
    profilePicture?: string;
    phoneNumber?: string;
    email?: string;
}

const App: React.FC = () => {
    const [page, setPage] = useState<'login' | 'products' | 'register' | 'profile'>('login');
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const checkToken = async () => {
            try {
                const storedToken = await AsyncStorage.getItem('jwt_token');
                if (storedToken) {
                    console.log('Found stored token:', storedToken.substring(0, 20) + '...');
                    setToken(storedToken);
                    try {
                        const userResponse = await api.get('/user/profile');
                        console.log('User profile loaded:', userResponse.data);
                        setUser({
                            name: userResponse.data.userName,
                            profilePicture: userResponse.data.profilePicture,
                            phoneNumber: userResponse.data.phoneNumber,
                            email: userResponse.data.email,
                        });
                        setPage('products');
                    } catch (error) {
                        console.error('Failed to fetch user profile:', (error as Error).message);
                        await AsyncStorage.removeItem('jwt_token');
                        setToken(null);
                        setUser(null);
                        setPage('login');
                    }
                } else {
                    console.log('No stored token, redirecting to login');
                    setPage('login');
                }
            } catch (error) {
                console.error('Помилка перевірки токена:', (error as Error).message);
                setPage('login');
            }
        };
        checkToken();
    }, []);

    const checkServer = async () => {
        try {
            console.log('Перевірка доступності сервера...');
            const response = await api.get('/ping');
            console.log('Сервер доступний! Відповідь:', response.data);
            return true;
        } catch (error) {
            console.error('Server check failed:', (error as Error).message);
            Alert.alert('Помилка мережі', `Не вдалося підключитися до сервера. Перевір IP, порт або брандмауер.\nДеталі: ${(error as Error).message}`);
            return false;
        }
    };

    const handleLogout = async () => {
        try {
            await api.post('/user/logout');
            await AsyncStorage.removeItem('jwt_token');
            setToken(null);
            setUser(null);
            setPage('login');
            Alert.alert('Успіх', 'Ви вийшли з системи.');
        } catch (error) {
            console.error('Logout error:', (error as Error).message);
            Alert.alert('Помилка', 'Не вдалося вийти: ' + (error as Error).message);
            await AsyncStorage.removeItem('jwt_token');
            setToken(null);
            setUser(null);
            setPage('login');
        }
    };

    return (
        <View style={styles.container}>
            {page === 'register' && <Register setPage={setPage} setToken={setToken} setUser={setUser} />}
            {page === 'login' && <Login setPage={setPage} setToken={setToken} setUser={setUser} />}
            {page === 'products' && token && user && (
                <Products
                    token={token}
                    user={user}
                    setUser={setUser}
                    setPage={setPage}
                    onLogout={handleLogout}
                />
            )}
            {page === 'profile' && token && user && (
                <Profile
                    user={user}
                    onUpdate={setUser}
                    onLogout={handleLogout}
                    setPage={setPage}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
});

export default App;