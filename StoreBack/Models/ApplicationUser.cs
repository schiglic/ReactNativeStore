using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations;

namespace StoreBack.Models
{
    public class ApplicationUser : IdentityUser
    {
        [Required]
        public new string UserName { get; set; } // Логін, зроблено обов'язковим
        public string PhoneNumber { get; set; } // Необов'язковий
        public string Email { get; set; } // Необов'язковий
        [Required]
        public string ProfilePicture { get; set; } // Шлях до картинки, обов'язковий
    }
}