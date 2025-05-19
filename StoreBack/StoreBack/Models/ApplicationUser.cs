using Microsoft.AspNetCore.Identity;

namespace StoreBack.Models
{
    public class ApplicationUser : IdentityUser
    {
        public string ProfilePicturePath { get; set; } // Шлях до картинки профілю
    }
}