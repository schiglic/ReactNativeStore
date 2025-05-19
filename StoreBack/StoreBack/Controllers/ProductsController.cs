using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StoreBack.Data;
using StoreBack.Models;
using System.Security.Claims;

namespace StoreBack.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProductsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IWebHostEnvironment _environment;

        public ProductsController(ApplicationDbContext context, IWebHostEnvironment environment)
        {
            _context = context;
            _environment = environment;
        }

        [HttpGet]
        [Authorize]
        public async Task<ActionResult<IEnumerable<Product>>> GetProducts()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null)
                return Unauthorized();

            var products = await _context.Products
                .Where(p => p.UserId == userId)
                .ToListAsync();

            return Ok(products);
        }

        [HttpPost]
        [Authorize]
        public async Task<IActionResult> AddProduct([FromForm] string name, [FromForm] string description, [FromForm] decimal price, [FromForm] IFormFile image)
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId == null)
                return Unauthorized();

            if (image == null || image.Length == 0)
                return BadRequest(new { message = "Image is required" });

            var uploadsFolder = Path.Combine(_environment.WebRootPath, "Images");
            if (!Directory.Exists(uploadsFolder))
                Directory.CreateDirectory(uploadsFolder);

            var uniqueFileName = Guid.NewGuid().ToString() + "_" + image.FileName;
            var filePath = Path.Combine(uploadsFolder, uniqueFileName);

            using (var fileStream = new FileStream(filePath, FileMode.Create))
            {
                await image.CopyToAsync(fileStream);
            }

            var product = new Product
            {
                Name = name,
                Description = description,
                Price = price,
                ImagePath = $"/Images/{uniqueFileName}",
                UserId = userId
            };

            _context.Products.Add(product);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Product added successfully", product });
        }
    }
}