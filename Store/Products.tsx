import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, Image, FlatList, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api from './api';

interface ProductsProps {
    token: string;
    user: { name: string; profilePicture?: string; phoneNumber?: string; email?: string } | null;
    setUser: (user: { name: string; profilePicture?: string; phoneNumber?: string; email?: string } | null) => void;
    setPage: (page: 'login' | 'products' | 'register' | 'profile') => void;
    onLogout: () => void;
}

interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    image: string | null;
}

const Products: React.FC<ProductsProps> = ({ token, user, setUser, setPage, onLogout }) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [productName, setProductName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [productImage, setProductImage] = useState<string | null>(null);
    const [editProduct, setEditProduct] = useState<Product | null>(null);

    const fetchProducts = async () => {
        try {
            const response = await api.get('/product');
            setProducts(response.data);
        } catch (error) {
            console.error('Помилка отримання продуктів:', (error as Error).message);
            Alert.alert('Помилка', 'Не вдалося отримати товари.');
            if ((error as any).response?.status === 401) {
                Alert.alert('Помилка авторизації', 'Сесія закінчилася. Увійдіть знову.');
                setPage('login');
            }
        }
    };

    useEffect(() => {
        if (token) {
            fetchProducts();
        }
    }, [token]);

    const pickProductImage = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('Дозвіл відхилено', 'Дозвольте доступ до фото.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            base64: true,
            quality: 0.2,
        });
        if (!result.canceled) {
            const base64Data = result.assets[0].base64 || null;
            setProductImage(base64Data);
            console.log('Product photo selected:', base64Data ? `Base64 length: ${base64Data.length}` : 'No base64 data');
        }
    };

    const handleAddProduct = async () => {
        if (!productName || !description || !price) {
            Alert.alert('Помилка', 'Заповніть усі поля.');
            return;
        }
        const priceNum = parseFloat(price);
        if (isNaN(priceNum) || priceNum <= 0) {
            Alert.alert('Помилка', 'Ціна має бути валідним додатним числом.');
            return;
        }
        const isServerUp = await checkServer();
        if (!isServerUp) return;

        try {
            const formData = new FormData();
            formData.append('name', productName);
            formData.append('description', description);
            formData.append('price', priceNum.toString());
            if (productImage) {
                formData.append('ImageBase64', productImage);
                console.log('Sending product FormData:', {
                    name: productName,
                    description: description,
                    price: priceNum,
                    ImageBase64: `Base64 length: ${productImage.length}`,
                });
            }
            await api.post('/product', formData);
            await fetchProducts();
            setProductName('');
            setDescription('');
            setPrice('');
            setProductImage(null);
            Alert.alert('Успіх', 'Товар додано!');
        } catch (error) {
            console.error('Product add error details:', (error as Error).message);
            Alert.alert('Помилка', (error as Error).message || 'Не вдалося додати товар.');
            if ((error as any).response?.status === 401) {
                Alert.alert('Помилка авторизації', 'Сесія закінчилася. Увійдіть знову.');
                setPage('login');
            }
        }
    };

    const handleEditProduct = (product: Product) => {
        setEditProduct(product);
        setProductName(product.name);
        setDescription(product.description);
        setPrice(product.price.toString());
        setProductImage(null);
    };

    const handleUpdateProduct = async () => {
        if (!editProduct || !productName || !description || !price) {
            Alert.alert('Помилка', 'Заповніть усі поля.');
            return;
        }
        const priceNum = parseFloat(price);
        if (isNaN(priceNum) || priceNum <= 0) {
            Alert.alert('Помилка', 'Ціна має бути валідним додатним числом.');
            return;
        }
        const isServerUp = await checkServer();
        if (!isServerUp) return;

        try {
            const formData = new FormData();
            formData.append('name', productName);
            formData.append('description', description);
            formData.append('price', priceNum.toString());
            if (productImage) {
                formData.append('ImageBase64', productImage);
                console.log('Sending updated product FormData:', {
                    name: productName,
                    description: description,
                    price: priceNum,
                    ImageBase64: `Base64 length: ${productImage.length}`,
                });
            }
            await api.put(`/product/${editProduct.id}`, formData);
            await fetchProducts();
            setEditProduct(null);
            setProductName('');
            setDescription('');
            setPrice('');
            setProductImage(null);
            Alert.alert('Успіх', 'Товар оновлено!');
        } catch (error) {
            console.error('Product update error details:', (error as Error).message);
            Alert.alert('Помилка', (error as Error).message || 'Не вдалося оновити товар.');
            if ((error as any).response?.status === 401) {
                Alert.alert('Помилка авторизації', 'Сесія закінчилася. Увійдіть знову.');
                setPage('login');
            }
        }
    };

    const handleDeleteProduct = async (productId: string) => {
        Alert.alert(
            'Підтвердження',
            'Ви впевнені, що хочете видалити цей товар?',
            [
                { text: 'Скасувати', style: 'cancel' },
                {
                    text: 'Видалити',
                    onPress: async () => {
                        try {
                            const isServerUp = await checkServer();
                            if (!isServerUp) return;

                            await api.delete(`/product/${productId}`);
                            await fetchProducts();
                            Alert.alert('Успіх', 'Товар видалено!');
                        } catch (error) {
                            console.error('Product delete error details:', (error as Error).message);
                            Alert.alert('Помилка', (error as Error).message || 'Не вдалося видалити товар.');
                            if ((error as any).response?.status === 401) {
                                Alert.alert('Помилка авторизації', 'Сесія закінчилася. Увійдіть знову.');
                                setPage('login');
                            }
                        }
                    },
                    style: 'destructive',
                },
            ]
        );
    };

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

    const renderProduct = ({ item }: { item: Product }) => (
        <View style={styles.productItem}>
            {item.image && (
                <Image
                    source={{ uri: `http://192.168.1.2:5259/${item.image}` }}
                    style={styles.productImage}
                    onError={(e) => console.log('Image load error:', e.nativeEvent.error)}
                />
            )}
            <Text style={styles.productText}>Назва: {item.name}</Text>
            <Text style={styles.productText}>Опис: {item.description}</Text>
            <Text style={styles.productText}>Ціна: ${item.price}</Text>
            <View style={styles.buttonRow}>
                <View style={styles.button}>
                    <Button title="Редагувати" onPress={() => handleEditProduct(item)} />
                </View>
                <View style={styles.button}>
                    <Button title="Видалити" onPress={() => handleDeleteProduct(item.id)} color="red" />
                </View>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Профіль: {user?.name}</Text>
                {user?.profilePicture && (
                    <Image
                        source={{ uri: `http://192.168.1.2:5259/${user.profilePicture}` }}
                        style={styles.profileImage}
                        onError={(e) => console.log('Profile image load error:', e.nativeEvent.error)}
                    />
                )}
                <View style={styles.headerButtons}>
                    <View style={styles.button}>
                        <Button title="Профіль" onPress={() => setPage('profile')} />
                    </View>
                    <View style={styles.button}>
                        <Button title="Вийти" onPress={onLogout} color="red" />
                    </View>
                </View>
            </View>
            {editProduct ? (
                <>
                    <Text style={styles.title}>Редагувати товар</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Назва товару"
                        value={productName}
                        onChangeText={setProductName}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Опис"
                        value={description}
                        onChangeText={setDescription}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Ціна"
                        value={price}
                        onChangeText={setPrice}
                        keyboardType="numeric"
                    />
                    <Button title="Обрати нове фото товару" onPress={pickProductImage} />
                    {productImage && <Image source={{ uri: `data:image/jpeg;base64,${productImage}` }} style={styles.image} />}
                    <View style={styles.buttonRow}>
                        <View style={styles.button}>
                            <Button title="Оновити товар" onPress={handleUpdateProduct} />
                        </View>
                        <View style={styles.button}>
                            <Button title="Скасувати" onPress={() => setEditProduct(null)} color="gray" />
                        </View>
                    </View>
                </>
            ) : (
                <>
                    <TextInput
                        style={styles.input}
                        placeholder="Назва товару"
                        value={productName}
                        onChangeText={setProductName}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Опис"
                        value={description}
                        onChangeText={setDescription}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Ціна"
                        value={price}
                        onChangeText={setPrice}
                        keyboardType="numeric"
                    />
                    <Button title="Обрати фото товару" onPress={pickProductImage} />
                    {productImage && <Image source={{ uri: `data:image/jpeg;base64,${productImage}` }} style={styles.image} />}
                    <Button title="Додати товар" onPress={handleAddProduct} />
                    <FlatList
                        data={products}
                        renderItem={renderProduct}
                        keyExtractor={(item) => item.id}
                        style={styles.productList}
                    />
                </>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#fff',
    },
    header: {
        marginBottom: 20,
        alignItems: 'center',
    },
    headerButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginTop: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
    },
    input: {
        height: 40,
        borderColor: 'gray',
        borderWidth: 1,
        marginBottom: 10,
        paddingHorizontal: 10,
    },
    image: {
        width: 100,
        height: 100,
        marginVertical: 10,
        alignSelf: 'center',
    },
    profileImage: {
        width: 100,
        height: 100,
        marginVertical: 10,
        alignSelf: 'center',
        borderRadius: 50,
    },
    productList: {
        marginTop: 20,
    },
    productItem: {
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
    },
    productImage: {
        width: 50,
        height: 50,
        marginBottom: 5,
    },
    productText: {
        fontSize: 16,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    button: {
        flex: 1,
        marginHorizontal: 5,
    },
});

export default Products;