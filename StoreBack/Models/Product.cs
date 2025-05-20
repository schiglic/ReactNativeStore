using System.ComponentModel.DataAnnotations;

namespace StoreBack.Models
{
    public class Product
    {
        public int Id { get; set; }
        [Required]
        public string Name { get; set; }
        [Required]
        public string Description { get; set; }
        [Required]
        public string Image { get; set; } // Шлях до картинки
        [Required]
        public decimal Price { get; set; }
        public string UserId { get; set; } // Foreign key to ApplicationUser
        public ApplicationUser User { get; set; }
    }
}