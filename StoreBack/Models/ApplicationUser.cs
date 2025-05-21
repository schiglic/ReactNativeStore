using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations;

namespace StoreBack.Models
{
    public class ApplicationUser : IdentityUser
    {
        public string PhoneNumber { get; set; }
        public string Email { get; set; }
        [Required]
        public string ProfilePicture { get; set; }
    }
}