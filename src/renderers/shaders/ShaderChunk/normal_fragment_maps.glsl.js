export default /* glsl */`

#ifdef OBJECTSPACE_NORMALMAP

	normal = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0; // overrides both flatShading and attribute normals

	#ifdef FLIP_SIDED

		normal = - normal;

	#endif

	#ifdef DOUBLE_SIDED

		normal = normal * faceDirection;

	#endif

	normal = normalize( normalMatrix * normal );

#elif defined( TANGENTSPACE_NORMALMAP )

	vec3 mapN = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;

	#ifdef USE_LOWER_8_BIT_NORMALMAP

	vec3 lowerMapN = texture2D( lowerNormalMap, vUv ).xyz * 2.0 - 1.0;
	mapN = mapN * (256.0 / 257.0) + lowerMapN / 257.0;

	#endif

	#ifdef USE_COARSE_NORMALMAP

	// https://blog.selfshadow.com/publications/blending-in-detail/
	mapN.z += 1.0;
	vec3 coarseMapN = texture2D( coarseNormalMap, vUv2 ).xyz * vec3( -2.0, -2.0, 2.0 ) + vec3( 1.0, 1.0, -1.0 );
	mapN = mapN * dot( mapN, coarseMapN ) / mapN.z - coarseMapN;

	#endif

	mapN.xy *= normalScale;

	#ifdef USE_TANGENT

		normal = normalize( vTBN * mapN );

	#else

		normal = perturbNormal2Arb( - vViewPosition, normal, mapN, faceDirection );

	#endif

#elif defined( USE_BUMPMAP )

	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );

#endif
`;
