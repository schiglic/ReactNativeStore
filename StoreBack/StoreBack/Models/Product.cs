namespace StoreBack.Models
{
    public class Product
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public decimal Price { get; set; }
        public string ImagePath { get; set; } // Шлях до картинки (наприклад, "/Images/product1.jpg")
        public string UserId { get; set; } // ID користувача, якому належить товар
    }
}